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

const AkkaServerless =
  require('@lightbend/akkaserverless-javascript-sdk').AkkaServerless;
const server = new AkkaServerless();
const action = require('./action.js');
server.addComponent(action.tckModel);
server.addComponent(action.two);
const replicatedEntity = require('./replicated-entity.js');
server.addComponent(replicatedEntity.tckModel);
server.addComponent(replicatedEntity.two);
server.addComponent(replicatedEntity.configured);
const eventSourcedEntity = require('./event-sourced-entity.js');
server.addComponent(eventSourcedEntity.tckModel);
server.addComponent(eventSourcedEntity.two);
server.addComponent(eventSourcedEntity.configured);
const valueEntity = require('./value-entity.js');
server.addComponent(valueEntity.tckModel);
server.addComponent(valueEntity.two);
server.addComponent(valueEntity.configured);
const localPersistenceEventing = require('./local-persistence-eventing.js');
server.addComponent(localPersistenceEventing.eventSourcedEntityOne);
server.addComponent(localPersistenceEventing.eventSourcedEntityTwo);
server.addComponent(localPersistenceEventing.valueEntityOne);
server.addComponent(localPersistenceEventing.valueEntityTwo);
server.addComponent(localPersistenceEventing.localPersistenceSubscriber);
const view = require('./view.js');
server.addComponent(view.tckModel);
server.addComponent(view.viewSource);
server.start();

module.exports = server;
