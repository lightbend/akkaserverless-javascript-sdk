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

// tag::import-replicatedentity[]
import { replicatedentity } from "@lightbend/kalix-javascript-sdk";

// end::import-replicatedentity[]
// tag::import-replies[]
import { replies } from "@lightbend/kalix-javascript-sdk";

// end::import-replies[]
// tag::types[]
import * as proto from "../lib/generated/proto";

type AddLineItem = proto.com.example.shoppingcart.AddLineItem;
type RemoveLineItem = proto.com.example.shoppingcart.RemoveLineItem;
type GetShoppingCart = proto.com.example.shoppingcart.GetShoppingCart;
type RemoveShoppingCart = proto.com.example.shoppingcart.RemoveShoppingCart;

type Context = replicatedentity.ReplicatedEntityCommandContext;

// end::types[]
// tag::class[]
const entity = new replicatedentity.ReplicatedEntity( // <1>
  ["shoppingcart_domain.proto", "shoppingcart_api.proto"], // <2>
  "com.example.shoppingcart.ShoppingCartService", // <3>
  "shopping-cart", // <4>
  {
    includeDirs: ["./proto"], // <5>
  }
);
// end::class[]

// tag::defaultValue[]
entity.defaultValue = () => new replicatedentity.ReplicatedCounterMap(); // <1>
// end::defaultValue[]

// tag::types[]
const Product = entity.lookupType("com.example.shoppingcart.domain.Product");
const Cart = entity.lookupType("com.example.shoppingcart.Cart");
const Empty = entity.lookupType("google.protobuf.Empty");
// end::types[]

// tag::commandHandlers[]
entity.commandHandlers = {
  AddItem: addItem,
  RemoveItem: removeItem,
  GetCart: getCart,
  RemoveCart: removeCart,
};
// end::commandHandlers[]

// tag::addItem[]
function addItem(addLineItem: AddLineItem, context: Context) {
  if (addLineItem.quantity <= 0) {
    return replies.failure(`Quantity for item ${addLineItem.productId} must be greater than zero`); // <1>
  }

  const cart = context.state as replicatedentity.ReplicatedCounterMap; // <2>

  const product = Product.create({
    id: addLineItem.productId, // <3>
    name: addLineItem.name,
  });

  cart.increment(product, addLineItem.quantity); // <4>

  return replies.message(Empty.create()); // <5>
}
// end::addItem[]

function removeItem(removeLineItem: RemoveLineItem, context: Context) {
  const cart = context.state as replicatedentity.ReplicatedCounterMap;

  const product = Product.create({
    id: removeLineItem.productId,
    name: removeLineItem.name,
  });

  if (!cart.has(product)) {
    return replies.failure(`Item to remove is not in the cart: ${removeLineItem.productId}`);
  }

  cart.delete(product);

  return replies.message(Empty.create());
}

// tag::getCart[]
function getCart(getShoppingCart: GetShoppingCart, context: Context) {
  const cart = context.state as replicatedentity.ReplicatedCounterMap; // <1>

  const items = Array.from(cart.keys()) // <2>
    .map(product => ({
      productId: product.id,
      name: product.name,
      quantity: cart.get(product), // <3>
    }));

  return replies.message(Cart.create({ items: items })); // <4>
}
// end::getCart[]

// tag::removeCart[]
function removeCart(removeShoppingCart: RemoveShoppingCart, context: Context) {
  context.delete(); // <1>
  return replies.message(Empty.create()); // <2>
}
// end::removeCart[]

export default entity;
