### Prepare

- [ ] Make sure all important PRs have been merged
- [ ] Check that the [latest build](https://app.circleci.com/pipelines/github/lightbend/kalix-javascript-sdk) successfully finished
- [ ] Make sure a version of the proxy that supports the protocol version the SDK expects has been deployed to production

You can see the proxy version on prod [on grafana](https://lightbendcloud.grafana.net/d/ebzw4ARnz/prod-akka-serverless-operations-dashboard?orgId=1) or using [various other methods](https://github.com/lightbend/akkaserverless/wiki/Versioning-and-how-to-determine-what-version-is-running).

### Cutting the release

- [ ] Edit the [draft release notes](https://github.com/lightbend/kalix-javascript-sdk/releases) and create the appropriate tag
    - CircleCI will automatically publish the [@lightbend/kalix-javascript-sdk package](https://www.npmjs.com/package/@lightbend/kalix-javascript-sdk) to the npm registry based on the tag
    - CI will update the docs/current branch

### Check availability

- [ ] Check that [`docs/current`](https://github.com/lightbend/kalix-javascript-sdk/commits/docs/current) has been updated
- [ ] Check the release in the [npm registry](https://www.npmjs.com/package/@lightbend/kalix-javascript-sdk)

### Fix and publish docs

- [ ] Update the [supported version in the main docs](https://github.com/lightbend/akkaserverless-docs/blob/master/docs/modules/ROOT/partials/include.adoc#L20) if relevant (affects [Supported Versions](https://docs.kalix.io/setting-up/index.html#_supported_languages))
- [ ] Add an item to the [Release Notes](https://github.com/lightbend/akkaserverless-docs/blob/master/docs/modules/release-notes/pages/index.adoc) in the documentation
- [ ] Release the Kalix documentation to get the SDK docs updates published

### Update to the latest version

- [ ] Run `samples/bin/update.sh` to update the samples to the latest released versions.

### Check docs update

- [ ] After quite a while TechHub shows [updated docs](https://docs.kalix.io/index.html) (see the timestamp on the bottom of the page)

### Announcements

- [ ] Announce in [the forum](https://discuss.lightbend.com/c/akka-serverless/40)
    - tag with Kalix, releases and announcement
- [ ] Inform Lightbend marketing and engineering if it's a noteworthy release
- [ ] Close this issue
