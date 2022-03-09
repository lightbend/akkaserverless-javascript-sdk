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

export class ContextFailure extends Error {
  readonly name: string = 'ContextFailure';
  readonly msg: string;
  readonly grpcStatus?: number;

  constructor(msg: string, grpcStatus?: number) {
    super(msg);
    this.msg = msg;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextFailure);
    }
    if (grpcStatus !== undefined) {
      if (grpcStatus === 0) {
        throw new Error('gRPC failure status code must not be OK');
      }
      if (grpcStatus < 0 || grpcStatus > 16) {
        throw new Error('Invalid gRPC status code: ' + grpcStatus);
      }
      this.grpcStatus = grpcStatus;
    }
  }
}
