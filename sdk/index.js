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

/**
 * The Kalix module.
 *
 * @module kalix
 */

module.exports.Kalix = require('./src/kalix').Kalix;
module.exports.EventSourcedEntity = require('./src/event-sourced-entity');
module.exports.ValueEntity = require('./src/value-entity');
module.exports.replicatedentity = require('./src/replicated-entity').exported;
module.exports.ReplicatedWriteConsistency =
  require('./src/kalix').ReplicatedWriteConsistency;
module.exports.Action = require('./src/action').default;
module.exports.Metadata = require('./src/metadata').Metadata;
module.exports.IntegrationTestkit =
  require('./src/integration-testkit').IntegrationTestkit;
module.exports.View = require('./src/view');
module.exports.replies = require('./src/reply');
module.exports.settings = require('./settings');
module.exports.GrpcUtil = require('./src/grpc-util').GrpcUtil;
module.exports.GrpcStatus = require('./src/kalix').GrpcStatus;
