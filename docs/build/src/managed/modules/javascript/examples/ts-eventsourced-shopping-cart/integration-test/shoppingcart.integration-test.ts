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

import { IntegrationTestkit } from "@kalix-io/testkit";
import { expect } from "chai";
import * as proto from "../lib/generated/proto";
import shoppingcartEnity from "../src/shoppingcart";

type ShoppingCartService = proto.com.example.shoppingcart.ShoppingCartService;

type ServiceMethods<S extends protobuf.rpc.Service> = {
  [M in keyof S]: S[M] extends (x: any) => Promise<any> ? M : never;
}[keyof S];

type AsyncShoppingCartService = {
  [M in ServiceMethods<ShoppingCartService> as `${M}Async`]: (
    ...args: Parameters<ShoppingCartService[M]>
  ) => ReturnType<ShoppingCartService[M]>;
};

const testkit = new IntegrationTestkit().addComponent(shoppingcartEnity);

function client(): AsyncShoppingCartService {
  return testkit.clients.ShoppingCartService;
}

describe("Shopping cart service", function () {
  this.timeout(60000);

  before(done => testkit.start(done));
  after(done => testkit.shutdown(done));

  it("should default to an empty cart", async () => {
    const cart = await client().getCartAsync({ cartId: "cart1" });
    expect(cart).to.deep.equal({});
  });

  it("should add items to a cart", async () => {
    await client().addItemAsync({
      cartId: "cart2",
      productId: "a",
      name: "Apple",
      quantity: 1
    });
    await client().addItemAsync({
      cartId: "cart2",
      productId: "b",
      name: "Banana",
      quantity: 2
    });
    await client().addItemAsync({
      cartId: "cart2",
      productId: "c",
      name: "Cantaloupe",
      quantity: 3
    });

    const cart = await client().getCartAsync({ cartId: "cart2" });
    expect(cart.items).to.deep.equal([
      { productId: "a", name: "Apple", quantity: 1 },
      { productId: "b", name: "Banana", quantity: 2 },
      { productId: "c", name: "Cantaloupe", quantity: 3 }
    ]);
  });

  it("should remove items from a cart", async () => {
    await client().addItemAsync({
      cartId: "cart3",
      productId: "a",
      name: "Apple",
      quantity: 1
    });
    await client().addItemAsync({
      cartId: "cart3",
      productId: "b",
      name: "Banana",
      quantity: 2
    });

    {
      // after adding items
      const cart = await client().getCartAsync({ cartId: "cart3" });
      expect(cart.items).to.deep.equal([
        { productId: "a", name: "Apple", quantity: 1 },
        { productId: "b", name: "Banana", quantity: 2 }
      ]);
    }

    await client().removeItemAsync({ cartId: "cart3", productId: "a" });
    {
      // after removing 'Apple'
      const cart = await client().getCartAsync({ cartId: "cart3" });
      expect(cart.items).to.deep.equal([
        { productId: "b", name: "Banana", quantity: 2 }
      ]);
    }
  });
});
