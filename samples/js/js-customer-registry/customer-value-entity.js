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

const ValueEntity = require("@kalix-io/kalix-javascript-sdk").ValueEntity;
const { replies } = require("@kalix-io/kalix-javascript-sdk");

const entity = new ValueEntity(
  ["customer_api.proto", "customer_domain.proto"],
  "customer.api.CustomerService",
  "customers"
);

const domainPkg = "customer.domain.";
const domain = {
  CustomerState: entity.lookupType(domainPkg + "CustomerState"),
  Address: entity.lookupType(domainPkg + "Address"),
}
const apiPkg = "customer.api."
const api = {
  Customer: entity.lookupType(apiPkg + "Customer")
}

entity.setInitial(customerId => domain.CustomerState.create({ customerId: customerId }));

entity.setCommandHandlers({
  Create: create,
  ChangeName: changeName,
  ChangeAddress: changeAddress,
  GetCustomer: getCustomer
})

function create(customer, customerState, ctx) {
  let domainCustomer = apiCustomerToCustomerState(customer)
  ctx.updateState(domainCustomer)
  return replies.emptyReply()
}

function changeName(changeNameRequest, customerState, ctx) {
  if (!customerState.name && !customerState.email) {
    return replies.failure("Customer must be created before name can be changed.")
  } else {
    customerState.name = changeNameRequest.newName
    ctx.updateState(customerState)
    return replies.emptyReply()
  }
}

function changeAddress(changeAddressRequest, customerState, ctx) {
  if (!customerState.name) {
    return replies.failure("Customer must be created before address can be changed.")
  } else {
    customerState.address = changeAddressRequest.newAddress
    ctx.updateState(customerState)
    return replies.emptyReply()
  }
}

function getCustomer(request, state, ctx) {
  let apiCustomer = customerStateToApiCustomer(state)
  return replies.message(apiCustomer)
}

function apiCustomerToCustomerState(apiCustomer) {
  // right now these two have the same fields so conversion is easy
  return domain.CustomerState.create(apiCustomer)
}

function customerStateToApiCustomer(customerState) {
  // right now these two have the same fields so conversion is easy
  return api.Customer.create(customerState)
}

module.exports = entity;

