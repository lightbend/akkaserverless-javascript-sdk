/*
 * Copyright 2021 Lightbend Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as util from 'util';
import * as protobuf from 'protobufjs';
import * as grpc from '@grpc/grpc-js';
import { ServiceClientConstructor } from '@grpc/grpc-js/build/src/make-client';
import { IdentificationInfo } from '../types/protocol/discovery';
import { Func } from 'mocha';

/**
 * gRPC client.
 *
 * @public
 */
export interface GrpcClient extends grpc.Client {
  [methodName: string]: Function;
}

/**
 * gRPC client creator for a service.
 *
 * @public
 */
export interface GrpcClientCreator {
  /**
   * Create a new client for service.
   *
   * @param address - the address for the service, or undefined if client is for another component in this Kalix Service
   * @param credentials - the credentials for the connection
   * @returns a new gRPC client for the service
   */
  createClient(
    address?: string,
    credentials?: grpc.ChannelCredentials,
  ): GrpcClient;
}

/**
 * gRPC client lookup, using fully qualified name for service.
 *
 * @public
 */
export interface GrpcClientLookup {
  [index: string]: GrpcClientLookup | GrpcClientCreator;
}

/**
 * @private
 */
enum ServiceType {
  SELF,
  KALIX_SERVICE,
  EXTERNAL,
}

/** @public */
export class GrpcUtil {
  /**
   * Create gRPC client creators for defined services, with promisified clients.
   *
   * @internal
   */
  static clientCreators(
    namespace: protobuf.Namespace,
    grpcObject: grpc.GrpcObject,
    proxyHostname: string,
    proxyPort: number,
    identificationInfo?: IdentificationInfo,
  ): GrpcClientLookup {
    const result: GrpcClientLookup = {};
    let selfAuthHeaders: grpc.Metadata | undefined;
    let otherKalixServiceAuthHeaders: grpc.Metadata | undefined;
    if (identificationInfo?.selfIdentificationHeader) {
      selfAuthHeaders = new grpc.Metadata();
      selfAuthHeaders.add(
        identificationInfo.selfIdentificationHeader!,
        identificationInfo.selfIdentificationToken!,
      );
    }
    if (identificationInfo?.serviceIdentificationHeader) {
      // only set for local dev proxy
      otherKalixServiceAuthHeaders = new grpc.Metadata();
      otherKalixServiceAuthHeaders.add(
        identificationInfo.serviceIdentificationHeader!,
        identificationInfo.selfDeploymentName!,
      );
    }

    for (const serviceFqn of GrpcUtil.getServiceNames(namespace)) {
      let currentLookup = result;
      let currentGrpc = grpcObject;
      const nameComponents = serviceFqn.split('.');
      for (const packageName of nameComponents.slice(0, -1)) {
        if (!currentLookup[packageName]) {
          currentLookup[packageName] = {};
        }
        currentLookup = currentLookup[packageName] as GrpcClientLookup;
        currentGrpc = currentGrpc[packageName] as grpc.GrpcObject;
      }
      const serviceName = nameComponents[nameComponents.length - 1];
      const clientCreator = function (
        address?: string,
        credentials?: grpc.ChannelCredentials,
      ) {
        const creds = credentials || grpc.credentials.createInsecure();
        let actualAddress: string;
        let serviceType: ServiceType;
        if (address) {
          if (address.indexOf('.') > 0) {
            serviceType = ServiceType.EXTERNAL;
            actualAddress = address;
          } else if (address.startsWith(proxyHostname)) {
            // FIXME deprecate and warn about creating with manual address?
            // Note: this is not water tight, when running locally with docker it will likely be 'localhost' for all services
            serviceType = ServiceType.SELF;
            actualAddress = address;
          } else {
            serviceType = ServiceType.KALIX_SERVICE;
            if (address.indexOf(':') > 0) {
              actualAddress = address;
            } else {
              // allow users to use only the service name and add the port for them
              actualAddress = address + ':80';
            }
          }
        } else {
          // auto set self-host/port
          serviceType = ServiceType.SELF;
          actualAddress = proxyHostname + ':' + proxyPort;
        }

        const serviceClientConstructor = currentGrpc[
          serviceName
        ] as ServiceClientConstructor;

        const client = new serviceClientConstructor(actualAddress, creds);
        if (identificationInfo) {
          switch (serviceType) {
            case ServiceType.SELF:
              if (selfAuthHeaders)
                GrpcUtil.addHeadersToAllRequests(client, selfAuthHeaders);
              break;
            case ServiceType.KALIX_SERVICE:
              if (otherKalixServiceAuthHeaders)
                GrpcUtil.addHeadersToAllRequests(
                  client,
                  otherKalixServiceAuthHeaders,
                );
              break;
          }
        }
        return GrpcUtil.promisifyClient(client);
      };
      currentLookup[serviceName] = {
        createClient: clientCreator,
      };
    }
    return result;
  }

  /**
   * Iterate through a (resolved) protobufjs reflection object to find services.
   */
  static getServiceNames(
    obj: protobuf.ReflectionObject,
    parentName: string = '',
  ): Array<string> {
    const fullName = parentName === '' ? obj.name : parentName + '.' + obj.name;
    if (obj instanceof protobuf.Service) {
      return [fullName];
    } else if (
      obj instanceof protobuf.Namespace &&
      typeof obj.nestedArray !== 'undefined'
    ) {
      return obj.nestedArray
        .map((nestedObj) => GrpcUtil.getServiceNames(nestedObj, fullName))
        .reduce((acc, val) => acc.concat(val), []);
    }
    return [];
  }

  /**
   * Add default headers/metadata to all request methods
   */
  static addHeadersToAllRequests(
    client: any,
    metadataWithHeaders: grpc.Metadata,
  ) {
    Object.keys(Object.getPrototypeOf(client)).forEach((methodName) => {
      const originalMethod = client[methodName];
      // patch methods that are service calls
      if (originalMethod.requestStream !== undefined) {
        const patchedMethod: any = function patched() {
          // service calls has 2-4 parameters, find the metadata parameter if there is one
          const args = Array.prototype.slice.call(arguments);
          const indexOfMeta = args.findIndex((p) => p instanceof grpc.Metadata);
          if (indexOfMeta === -1) {
            // no metadata present, inject metadata param at position 1
            args.splice(1, 0, metadataWithHeaders);
          } else {
            // metadata present, merge/mutate
            const existingMeta = args[indexOfMeta];
            existingMeta.merge(metadataWithHeaders);
          }
          // call original method with patched metadata
          originalMethod.apply(client, args);
        };
        // copy fields from original method so that promisify works (sketchy)
        for (var attr in originalMethod) {
          patchedMethod[attr] = originalMethod[attr];
        }
        client[methodName] = patchedMethod;
      }
    });
  }

  /**
   * add async versions of unary request methods, suffixed with the given suffix
   */
  static promisifyClient(client: any, suffix: String = '') {
    Object.keys(Object.getPrototypeOf(client)).forEach((methodName) => {
      const methodFunction = client[methodName];
      if (
        methodFunction.requestStream == false &&
        methodFunction.responseStream == false
      ) {
        client[methodName + suffix] = util
          .promisify(methodFunction)
          .bind(client);
      }
    });
    return client;
  }
}
