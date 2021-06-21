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
 * The AkkaServerless module.
 *
 * @module akkaserverless
 */

module.exports.AkkaServerless = require('./src/akkaserverless');
module.exports.EventSourcedEntity = require('./src/event-sourced-entity');
module.exports.ValueEntity = require('./src/value-entity');
module.exports.ReplicatedEntity =
  require('./src/replicated-entity').ReplicatedEntity;
module.exports.ReplicatedData =
  require('./src/replicated-entity').ReplicatedData;
module.exports.Action = require('./src/action');
module.exports.Metadata = require('./src/metadata');
module.exports.IntegrationTestkit = require('./src/integration-testkit');
module.exports.View = require('./src/view');
module.exports.replies = require('./src/reply');
module.exports.settings = require('./settings');
