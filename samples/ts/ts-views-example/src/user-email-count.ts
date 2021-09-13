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

import { View } from "@lightbend/akkaserverless-javascript-sdk";
import * as proto from "../lib/generated/proto";

type State = proto.example.users.User;

type User = proto.example.users.User;

const view: View = new View(["users.proto"], "example.users.UserEmailCount", {
  viewId: "user-email-count"
});

view.setUpdateHandlers({
  UpdateUser: updateUser
});

function updateUser(userEvent: User, previousViewState: State) {
  console.log(
    "Updating view for " +
      userEvent.userId +
      " with " +
      userEvent.emails.length +
      " email addresses, previous state: " +
      JSON.stringify(previousViewState)
  );
  // object automagically turned into UserEmailCountState by sdk view logic
  return {
    userId: userEvent.userId,
    emailCount: userEvent.emails.length
  };
}

export default view;
