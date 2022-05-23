# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [6.2.11](https://github.com/hokify/agenda/compare/v6.2.10...v6.2.11) (2022-05-23)


### Bug Fixes

* bind correct context to process ([cf70739](https://github.com/hokify/agenda/commit/cf707396707b36d293eb99a79fbc618b75a54900))

### [6.2.10](https://github.com/hokify/agenda/compare/v6.2.9...v6.2.10) (2022-05-23)


### Bug Fixes

* check if lockedAt has been resetted in the meantime ([aa5323b](https://github.com/hokify/agenda/commit/aa5323b5669453761e8a1ddd146df828e6b2b410))
* improve errors for childs ([8e3b827](https://github.com/hokify/agenda/commit/8e3b8277d839c935e69f31a57177c7f79dbec836))

### [6.2.9](https://github.com/hokify/agenda/compare/v6.2.8...v6.2.9) (2022-05-20)


### Bug Fixes

* job timeout check and improve error handling for childs ([b365957](https://github.com/hokify/agenda/commit/b36595745e8b43939f9938b78af8d5a2e033b8fb))

### [6.2.8](https://github.com/hokify/agenda/compare/v6.2.7...v6.2.8) (2022-05-11)


### Bug Fixes

* use message bus instead of signal to cancel child ([fcec3a9](https://github.com/hokify/agenda/commit/fcec3a9bf43e36d4d3d81319ac71d1b3b01e16be))

### [6.2.7](https://github.com/hokify/agenda/compare/v6.2.6...v6.2.7) (2022-05-11)


### Bug Fixes

* use different appraoch to find definition file ([9d4c60e](https://github.com/hokify/agenda/commit/9d4c60ef7583a3bd27e4ed626624b684079f06bc))

### [6.2.6](https://github.com/hokify/agenda/compare/v6.2.5...v6.2.6) (2022-05-10)


### Bug Fixes

* add fork paramters to console ([9f2e7fd](https://github.com/hokify/agenda/commit/9f2e7fd5351dd42a060059fcb03234afb1dd9d8a))

### [6.2.5](https://github.com/hokify/agenda/compare/v6.2.4...v6.2.5) (2022-05-10)


### Bug Fixes

* improve exit code error message ([f1a5eb8](https://github.com/hokify/agenda/commit/f1a5eb816de789c64a65a44f9443f286c794caf6))

### [6.2.4](https://github.com/hokify/agenda/compare/v6.2.3...v6.2.4) (2022-05-10)


### Bug Fixes

* check if abort controller is supported ([a00d611](https://github.com/hokify/agenda/commit/a00d611839e69318fe5e71cfa600a344c3dc6746))

### [6.2.3](https://github.com/hokify/agenda/compare/v6.2.2...v6.2.3) (2022-05-10)

### [6.2.2](https://github.com/hokify/agenda/compare/v6.2.1...v6.2.2) (2022-05-10)


### Bug Fixes

* allow passing forkMode to every ([ff274ba](https://github.com/hokify/agenda/commit/ff274babb98ed859625986a174bcc27d36346820))

### [6.2.1](https://github.com/hokify/agenda/compare/v6.2.0...v6.2.1) (2022-05-10)


### Bug Fixes

* small code cleanups and new flag to toggle ([2a6e5fe](https://github.com/hokify/agenda/commit/2a6e5fe12e40447f1e30f1d53deb99c47ae92e68))

## [6.2.0](https://github.com/hokify/agenda/compare/v6.1.1...v6.2.0) (2022-05-09)


### Features

* allow to fork jobs in isolated sub process ([2a68c95](https://github.com/hokify/agenda/commit/2a68c9574e888b8b91196f6b237d901d944340a4))

### [6.1.1](https://github.com/hokify/agenda/compare/v6.1.0...v6.1.1) (2022-04-05)

## [6.1.0](https://github.com/hokify/agenda/compare/v6.0.9...v6.1.0) (2022-03-21)


### Features

* check if job state update was successful before running a job ([606e141](https://github.com/hokify/agenda/commit/606e1413ec939d1e368db4a1af67c86d867b48d5))

### [6.0.9](https://github.com/hokify/agenda/compare/v6.0.8...v6.0.9) (2022-03-18)

### [6.0.8](https://github.com/hokify/agenda/compare/v6.0.7...v6.0.8) (2022-01-10)

### [6.0.7](https://github.com/hokify/agenda/compare/v6.0.6...v6.0.7) (2021-12-12)

### [6.0.6](https://github.com/hokify/agenda/compare/v6.0.5...v6.0.6) (2021-12-10)


### Bug Fixes

* ensure locked at is processed as date ([3a5a0c4](https://github.com/hokify/agenda/commit/3a5a0c4123506001c4898020aa489eb8fd20c311))

### [6.0.5](https://github.com/hokify/agenda/compare/v6.0.4...v6.0.5) (2021-12-10)


### Bug Fixes

* give the test some more time ([e2cacb5](https://github.com/hokify/agenda/commit/e2cacb533b211ae28a3d4ee278918be4d0f897e9))
* only update job state fields during job processing ([be8e51b](https://github.com/hokify/agenda/commit/be8e51b197f46d6bf2bf6d36ce7cdcbe6df72cfd))

### [6.0.4](https://github.com/hokify/agenda/compare/v6.0.3...v6.0.4) (2021-12-05)


### Bug Fixes

* nextRunAt value can be null ([e39cfd0](https://github.com/hokify/agenda/commit/e39cfd089248a7a235cf69888c9714a99988a75f))

### [6.0.3](https://github.com/hokify/agenda/compare/v6.0.2...v6.0.3) (2021-12-03)


### Bug Fixes

* check if job has expired before we run it ([e301511](https://github.com/hokify/agenda/commit/e3015112ad1eb3d4852bae6686494e1316f02267))

### [6.0.2](https://github.com/hokify/agenda/compare/v6.0.0...v6.0.2) (2021-10-28)


### Bug Fixes

* changelog for v4 ([dd8b569](https://github.com/hokify/agenda/commit/dd8b569cf8df753d29b6913d6bc8d45403355860))
* too greedy locking ([26ad106](https://github.com/hokify/agenda/commit/26ad1067d715cd113079f207cc489cbf0adff706))

## [6.0.0](https://github.com/hokify/agenda/compare/v5.0.1...v6.0.0) (2021-08-27)

### ⚠ BREAKING CHANGES
* Upgrade to mongo driver 4

### [5.0.1](https://github.com/hokify/agenda/compare/v5.0.0...v5.0.1) (2021-02-12)


### Bug Fixes

* update deps and switch moment-timezone to luxon ([e5eb973](https://github.com/hokify/agenda/commit/e5eb973deaa3e02bc071b26e57edd6735928bb70))

## [5.0.0](https://github.com/hokify/agenda/compare/v4.1.6...v5.0.0) (2020-12-06)


### ⚠ BREAKING CHANGES

* Switching from [ncb000gt/node-cron](https://www.npmjs.com/package/cron) to [harrisiirak/cron-parser](https://www.npmjs.com/package/cron-parser) for cron-pattern parsing.

    Previously month was 0-based (0=January). Going forward standard Unix pattern is used, which is 1-based (1=January).

    Please update existing cron-patterns that specify a month (4th position of a pattern). The month is now 1 - 12

    1 = January

    2 = February

    3...

    | Example | Execute on 1st of January |
    |---------|---------------------------|
    | Old     | 0 0 1 **0** *             |
    | New     | 0 0 1 **1** *             |

    old Cron patterns

    ```
    * * * * * *
    | | | | | |
    | | | | | +-- Year              (range: 1900-3000)
    | | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
    | | | +------ Month of the Year (range: 0-11) NOTE: Difference here
    | | +-------- Day of the Month  (range: 1-31)
    | +---------- Hour              (range: 0-23)
    +------------ Minute            (range: 0-59)
    ```

    new cron patterns

    ```
    * * * * * *
    | | | | | |
    | | | | | +-- Year              (range: 1900-3000)
    | | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
    | | | +------ Month of the Year (range: 1-12) NOTE: Difference here
    | | +-------- Day of the Month  (range: 1-31)
    | +---------- Hour              (range: 0-23)
    +------------ Minute            (range: 0-59)
    ```

Co-authored-by: Aras Abbasi <a.abbasi@cognigy.com>

* switching from cron to cron-parser ([#16](https://github.com/hokify/agenda/issues/16)) ([e5c3bf1](https://github.com/hokify/agenda/commit/e5c3bf12d4b5db8ec846b0c9c332e247077d3485))

### [4.1.6](https://github.com/hokify/agenda/compare/v4.1.5...v4.1.6) (2020-11-19)


### Bug Fixes

* only unlock jobs with a next run at date on shutdown ([a458aea](https://github.com/hokify/agenda/commit/a458aea0017bf9ddde44f587e6e7da99b456663b))

### [4.1.5](https://github.com/hokify/agenda/compare/v4.1.4...v4.1.5) (2020-11-19)


### Bug Fixes

* **jobprocessor:** ensure set timeout is only called once for each job in the queue ([1590224](https://github.com/hokify/agenda/commit/159022495a83980aad82a5244313b8c0e7db9942))

### [4.1.4](https://github.com/hokify/agenda/compare/v4.1.3...v4.1.4) (2020-11-18)


### Bug Fixes

* **jobprocessor:** check if set timeout value is valid ([2afaaa3](https://github.com/hokify/agenda/commit/2afaaa3227bf78978024c914dbc4be0c29dff7a9))

### [4.1.3](https://github.com/hokify/agenda/compare/v4.1.2...v4.1.3) (2020-10-30)


### Bug Fixes

* only unlock jobs which have a nextRunAt jobs on shutdown ([291f16e](https://github.com/hokify/agenda/commit/291f16e7a32e92d44263ad4399237bef1a2168cb))
* simplify default values ([35d5424](https://github.com/hokify/agenda/commit/35d5424eb58e6237bac79db6dc81a82eef640f79))

### [4.1.2](https://github.com/hokify/agenda/compare/v4.1.1...v4.1.2) (2020-10-25)


### Bug Fixes

* isRunning for non job processor calls ([a5bb965](https://github.com/hokify/agenda/commit/a5bb965a57ffe28db8eae40311e0c102210509fa))
* wait for start of test job ([413f797](https://github.com/hokify/agenda/commit/413f79753a63f74b6c7a5bb3acf5e2e54e934fab))

### [4.1.1](https://github.com/hokify/agenda/compare/v4.1.0...v4.1.1) (2020-10-25)


### Bug Fixes

* isRunning, check if db returns a result ([e6ea7e2](https://github.com/hokify/agenda/commit/e6ea7e2817d7d5a113de80f68c33c62b75a8602a))

## [4.1.0](https://github.com/hokify/agenda/compare/v4.0.33...v4.1.0) (2020-10-25)


### Features

* isRunning querys database again if called by client ([1aaaa61](https://github.com/hokify/agenda/commit/1aaaa61f0a009563a84cb81036427c187076f190))


### Bug Fixes

* job processor handling for recurring jobs could fill up queue and block processing ([54bc53c](https://github.com/hokify/agenda/commit/54bc53c5ab995671e1b38e78f3afb06c82f9a830))
* job processor localQueueProcessing flag ([413f673](https://github.com/hokify/agenda/commit/413f673ce0cd8a73132853f14feb8ed9f300c4e4))
* rename err to error, fix typing of DefinitionProcessor, use debug ins… ([#9](https://github.com/hokify/agenda/issues/9)) ([39b598e](https://github.com/hokify/agenda/commit/39b598e24784da6cf640a29c2ce02732786e62fa))
* use isNaN check in isValidDate ([#10](https://github.com/hokify/agenda/issues/10)) ([3bc2e30](https://github.com/hokify/agenda/commit/3bc2e303d280c19899beacf7c7a732e4a6b08724))

### [4.0.33](https://github.com/hokify/agenda/compare/v4.0.32...v4.0.33) (2020-10-24)


### Bug Fixes

* fix outpout of agenda job status details ([82ab1a8](https://github.com/hokify/agenda/commit/82ab1a8bd41eee6e4050c852f05c3fcb0b2d0c4f))
* fix outpout of agenda job status details ([7b24f88](https://github.com/hokify/agenda/commit/7b24f8872bcbf9179c9905508defffdc01d95373))
* fix outpout of agenda job status details ([3dc0709](https://github.com/hokify/agenda/commit/3dc0709a9c320175f8f455ef6f00dfb51ae6328a))

### [4.0.32](https://github.com/hokify/agenda/compare/v4.0.31...v4.0.32) (2020-10-24)


### Bug Fixes

* logic for datbase connection ([7ee64c1](https://github.com/hokify/agenda/commit/7ee64c1ea6fd2b1f157917a0bdaed2b286510092))

### [4.0.31](https://github.com/hokify/agenda/compare/v4.0.30...v4.0.31) (2020-10-23)


### Bug Fixes

* **job-processor:** emit error when db query fails ([9bfabd3](https://github.com/hokify/agenda/commit/9bfabd3359051d04d4664b7821248cab7708b82a))

### [4.0.30](https://github.com/hokify/agenda/compare/v4.0.29...v4.0.30) (2020-10-23)


### Bug Fixes

* **job-processor:** emit error when db query fails ([eff80aa](https://github.com/hokify/agenda/commit/eff80aa60de38644235653ab81860915a1e32b17))

### [4.0.29](https://github.com/hokify/agenda/compare/v4.0.28...v4.0.29) (2020-10-22)


### Bug Fixes

* more typings ([#5](https://github.com/hokify/agenda/issues/5)) ([8d6e137](https://github.com/hokify/agenda/commit/8d6e13702bc1ce427ddc4cf6d5e7f7502af8db8c))

### [4.0.28](https://github.com/hokify/agenda/compare/v4.0.27...v4.0.28) (2020-10-20)


### Bug Fixes

* **tests:** rm console log from debugging ([b211c8e](https://github.com/hokify/agenda/commit/b211c8e7a30c731a3f2c3c9f01603f904bb52660))

### [4.0.27](https://github.com/hokify/agenda/compare/v4.0.26...v4.0.27) (2020-10-20)


### Bug Fixes

* **define:** warning if job definition exists already ([3fe9a6d](https://github.com/hokify/agenda/commit/3fe9a6d69e5dd177d513e54f1386980280201369))
* **job:** ensure agenda is ready before calling save job ([be4c026](https://github.com/hokify/agenda/commit/be4c0268c829676e61a9ad45fcf66d714d8923ca))
* **test:** cleanup tests ([c5d081a](https://github.com/hokify/agenda/commit/c5d081a5c4be45b44ffc4aba56c0be4b9dcdd714))
* **test:** debug failed lock expire test ([7d69680](https://github.com/hokify/agenda/commit/7d69680f4d69663037ee238480d96e2788e1f572))
* **test:** debug failed priority test ([924287c](https://github.com/hokify/agenda/commit/924287c4419a19dfc16ba756e3e064e163b1b048))
* **test:** fix timeout check ([e92cd85](https://github.com/hokify/agenda/commit/e92cd85c80a1e092405f00066359d595be03ad2f))
* **typings:** names -> name ([c2ca928](https://github.com/hokify/agenda/commit/c2ca9286abdc46b7aa22024170bf9e73f142a9e9))

### [4.0.26](https://github.com/hokify/agenda/compare/v4.0.25...v4.0.26) (2020-10-20)


### Bug Fixes

* **test:** just check if there are almost all jobs running ([b2a5e6e](https://github.com/hokify/agenda/commit/b2a5e6ebf99aa3b1749b671eeadf0c6e08e4bae8))

### [4.0.25](https://github.com/hokify/agenda/compare/v4.0.24...v4.0.25) (2020-10-20)


### Bug Fixes

* **jobprocessor:** check for object.fromEntries for node 10 support ([#3](https://github.com/hokify/agenda/issues/3)) ([b8cc61f](https://github.com/hokify/agenda/commit/b8cc61fe1e4199437d65014bff03cab65e6e077f))
* **jobprocessor:** ensure returnNextConcurrencyFreeJob is not returning same job each time ([11d6606](https://github.com/hokify/agenda/commit/11d6606706d70416a6d28a95dd65ab11576f8e51))
* **jobprocessor:** set job enqueud to true for future jobs ([a3d4203](https://github.com/hokify/agenda/commit/a3d42032011f868628862942737cdfc1594bb02b))
* **test:** unlock job test fix ([6446b64](https://github.com/hokify/agenda/commit/6446b64c9f22bbbb2ec098cec5c55ca9d659d439))
* more typings, minor functionality changes ([#2](https://github.com/hokify/agenda/issues/2)) ([b13d054](https://github.com/hokify/agenda/commit/b13d054889638e218a2706f05512340e764c395b))

### [4.0.24](https://github.com/hokify/agenda/compare/v4.0.22...v4.0.24) (2020-10-20)


### Bug Fixes

* **jobprocessor:** improve checkIfJobIsStillAlive ([2919083](https://github.com/hokify/agenda/commit/29190836cdc917eea6dd1f58d650c1d29c29514f))
* **jobprocessor:** prevent overloading of job queue processing ([9854007](https://github.com/hokify/agenda/commit/98540074fc76c1f8cbed269e239bd2e615629421))

### [4.0.22](https://github.com/hokify/agenda/compare/v4.0.21...v4.0.22) (2020-10-16)


### Bug Fixes

* **jobprocessor:** introduce a canceled property to check if job is still alive ([55b63d7](https://github.com/hokify/agenda/commit/55b63d787a3252adca316c97b7b6156ecb45853d))

### [4.0.21](https://github.com/hokify/agenda/compare/v2.0.0...v4.0.21) (2020-10-15)


### Features

* add queue size to running stats ([6271781](https://github.com/hokify/agenda/commit/6271781ea564d2d7d58b58b21c4bbc84ac793df1))
* added [@breejs](https://github.com/breejs) to README ([68ade1d](https://github.com/hokify/agenda/commit/68ade1daa07fa2045e7fbd1be5260b7b43094234))


### Bug Fixes

* add job name again stats output ([1aa2d4a](https://github.com/hokify/agenda/commit/1aa2d4a916ea3a1b0f573e935f435f7ebcf31cb1))
* Add try/catch block to agenda#now method ([#876](https://github.com/hokify/agenda/issues/876)) ([8e1fe23](https://github.com/hokify/agenda/commit/8e1fe2336638401f94fdc9ff497b0aec6fb422c4))
* add types for chai and fix expect in agenda.test.ts ([7d508a9](https://github.com/hokify/agenda/commit/7d508a91219be5a668ce346a277c922a6538128d))
* add typings for events ([a6c0356](https://github.com/hokify/agenda/commit/a6c0356964eee103299bbee4f8ec3d0f40f5129d))
* allow data type defintions for jobs ([ef85fc5](https://github.com/hokify/agenda/commit/ef85fc5ab8438539c009e964047a9bc60b984fb6))
* allow returing details for status ([7a8a5bf](https://github.com/hokify/agenda/commit/7a8a5bf87266eacd84f0e6b5fd1457a7a6b99def))
* check if job is still alive ([a39c809](https://github.com/hokify/agenda/commit/a39c809b9efff79696b5d7c6f15b726df62dbbe9))
* ensure check if job is dead is ending sometime :-) ([39950f3](https://github.com/hokify/agenda/commit/39950f38835dd501083d2075a788f176c61e52d9))
* ensure jobs are filled up till concurrency reached ([1a8bb31](https://github.com/hokify/agenda/commit/1a8bb31fde08b80ba41078930467ab18e82cf386))
* ensure new jobs are put on the left side of the job processing queue ([30e68ba](https://github.com/hokify/agenda/commit/30e68bad188cf55d34fb0c82f214de50eb997021))
* export all kind of types ([3bd90dc](https://github.com/hokify/agenda/commit/3bd90dcb1f2a1f50e630f56cd4ba150608dd77af))
* improve locking and ensure locks are released ([3160f0d](https://github.com/hokify/agenda/commit/3160f0dde049984d4ffaf721c38032376b281edb))
* make `touch` promise-based ([#667](https://github.com/hokify/agenda/issues/667)) ([0840588](https://github.com/hokify/agenda/commit/0840588935edfb79c49b8f47f3d76083d7836f8d)), closes [/github.com/agenda/agenda/blob/ff94c8a4c9bc564a0bed9eaa79de1c4fdbed0fde/lib/job/touch.js#L10-L13](https://github.com/hokify//github.com/agenda/agenda/blob/ff94c8a4c9bc564a0bed9eaa79de1c4fdbed0fde/lib/job/touch.js/issues/L10-L13) [/github.com/agenda/agenda/blob/bd8a8e003cd09d6e9826accbf6c30be75212a9a9/test/job.js#L352-L364](https://github.com/hokify//github.com/agenda/agenda/blob/bd8a8e003cd09d6e9826accbf6c30be75212a9a9/test/job.js/issues/L352-L364)
* not running jobs even though concurrency is not reached ([0e82025](https://github.com/hokify/agenda/commit/0e82025678679d9c0d083824df955409c04f3956))
* simplified verbiage ([ee3ce39](https://github.com/hokify/agenda/commit/ee3ce393cbe31318dffc2f3701fd68045bf28a46))
* simplify unlocking and improve logging ([a70f500](https://github.com/hokify/agenda/commit/a70f5009edd4d689305da6381caa08fec9c37036))
* skip index creation ([5242736](https://github.com/hokify/agenda/commit/5242736d8e9dd0834d8eee2277f2de7223f52551))
* tests, agenda-instance should have a smaller processEvery ([b248a2b](https://github.com/hokify/agenda/commit/b248a2b6c0403e6e355da88c96fda7b62e2e08db))
* try to solve the locking issue ([d2f3b20](https://github.com/hokify/agenda/commit/d2f3b207ee643b804d19226b70e8b0abd0695b06))
* use new mongo stack ([a2e74a9](https://github.com/hokify/agenda/commit/a2e74a9d86b978d6179a9fcbcf25728c8391175d))
* **locking:** ensure jobs are not locked too greedy ([5bc123a](https://github.com/hokify/agenda/commit/5bc123a494703ea03108a0ed256aa207f02465bb))
* **process-jobs:** also add name to lock call ([481ea77](https://github.com/hokify/agenda/commit/481ea77bebbd9cea2966b0cb8f4e401650147633))
* **update:** when saving a job via _id add job name ([24f6a84](https://github.com/hokify/agenda/commit/24f6a84451e8e4b995a5dcc418f0c1dd26fe8674))

3.1.0 / 2020-04-07
==================

_Stay safe!_

* Fix for skipImmediate resetting nextRunAt to current date ([#860](https://github.com/agenda/agenda/pull/860)) (Thanks @AshlinDuncan!)
* Fix deprecated reconnect options ([#948](https://github.com/agenda/agenda/pull/948)) (Thanks @ekegodigital!)
* Add ability to set a skip when querying jobs. ([#898](https://github.com/agenda/agenda/pull/898)) (Thanks @cjolif!)

Internal:
* Fixed deprecated MongoDB functions in tests ([#928](https://github.com/agenda/agenda/pull/928)) (Thanks @MichielDeMey!)
* Updated devDependencies

Thank you @koresar, @sampathBlam, and @MichielDeMey helping to review PRs for this release! 👏


3.0.0 / 2020-02-13
==================

* Support MongoDB's Unified Topology Design ([#921](https://github.com/agenda/agenda/pull/921)) (Thanks @viktorzavadil!)
* Fix: check that the new nextRunAt is different that the previous nextRunAt ([#863](https://github.com/agenda/agenda/pull/863)) (Thanks @RaphaelRheault!)
* Update dependencies. Most notably MongoDB driver 3.4 → 3.5 ([#899](https://github.com/agenda/agenda/pull/899), [#900](https://github.com/agenda/agenda/pull/900), [#903](https://github.com/agenda/agenda/pull/903), [#906](https://github.com/agenda/agenda/pull/906), [#908](https://github.com/agenda/agenda/pull/908), [#910](https://github.com/agenda/agenda/pull/910), [#912](https://github.com/agenda/agenda/pull/912), [#913](https://github.com/agenda/agenda/pull/913), [#920](https://github.com/agenda/agenda/pull/920), [#922](https://github.com/agenda/agenda/pull/922))
* Documentation updates, thanks @MichielDeMey and @Sunghee2. ([#923](https://github.com/agenda/agenda/pull/923) & [#907](https://github.com/agenda/agenda/pull/907))

BREAKING
--------

* Stop testing for Node.js 8. This might still work but we're no longer actively testing for it. ([#925](https://github.com/agenda/agenda/pull/925))

2.3.0 / 2019-12-16
==================

* Improved performance in situations when there are many "expired" jobs in the  database ([#869](https://github.com/agenda/agenda/pull/869)) (Thanks @mfred488!)
* Fix periodic node.js process unhandledRejection ([#887](https://github.com/agenda/agenda/pull/887)) (Thanks @koresar and @Scorpil)
* Update dependencies

2.2.0 / 2019-11-24
==================

  * Fix `skipImmediate` option in `.every` ([#861](https://github.com/agenda/agenda/pull/861)) (Thanks @erics2783!)
  * Add try/catch block to agenda#now method ([#876](https://github.com/agenda/agenda/pull/876)) (Thanks @sampathBlam!)
  * Refactor job queuing mechanism. Agenda n ow guarantees priority when executing jobs scheduled the same datetime. Fixes also some tests. ([#852](https://github.com/agenda/agenda/pull/852)) (Thank you @dmbarreiro!)
  * Update dependencies (Kudos @simison!)
    Most notably `mongodb` ~3.2.7 -> ~3.3.0 ([changelog](https://github.com/mongodb/node-mongodb-native/tree/v3.3.0)) — highlights:
    - Mongo DB Server Version 4.2 feature support
    - Merged `mongodb-core` into `node-mongodb-native`
    - Beta support for MongoDB Client-Side Encryption
    - SRV Polling for Sharded Clusters
  * Updates to documentation (Thank you @lautarobock, @sampathBlam, @indatawetrust)

2.1.0 / 2019-09-09
==================
  * Support async functions in job processing ([#653](https://github.com/agenda/agenda/pull/653)) (thanks @princjef!)
  * Allow sorting and limiting jobs when searching ([#665](https://github.com/agenda/agenda/pull/665)) (thank you @edwin-jones)
  * Update MongoClient connection settings with `useNewUrlParser: true` to remove the deprecation warning. ([#806](https://github.com/agenda/agenda/pull/806)) (thanks @dpawson905!)
  * Allow valid date strings when scheduling ([#808](https://github.com/agenda/agenda/pull/808)) (Thanks @wingsbob!)
  * Update dependencies ([#820](https://github.com/agenda/agenda/pull/820))
  * Update documentation (kudos @dandv, @pedruino and many others!)
  * Fix linting errors ([#847](https://github.com/agenda/agenda/pull/847)) (thanks @dmbarreiro!)

2.0.2 / 2018-09-15
==================
  * Fixes a MongoDB connection string issue with Atlas ([#674](
https://github.com/agenda/agenda/pull/674)

2.0.1 / 2018-08-30
==================
  * Fix a bug where `job.touch()` wasn't promise based, as it should've been ([#667](https://github.com/agenda/agenda/pull/667)

2.0.0 / 2018-07-19
==================
  * Rewrite tests: replace `mocha` and `blanket` with `ava` and `nyc` ([#506](https://github.com/agenda/agenda/pull/506))
  * Optimization: don't try and unlock jobs when `_lockedJobs` is empty ([#509](https://github.com/agenda/agenda/pull/509))
  * Code cleanup ([#503](https://github.com/agenda/agenda/pull/503))
  * Ensure tests pass for Node.js version 10 [#608](https://github.com/agenda/agenda/pull/608))
  * Add `skipImmediate` to `repeatEvery()` options to skip immediate run of repeated jobs when Agenda starts. See [documentation](https://github.com/agenda/agenda/blob/202c9e95b40115dc763641f55180db9a4f358272/README.md#repeateveryinterval-options) ([#594](https://github.com/agenda/agenda/pull/594))
  * Fixes some flaky tests
  * Adds docs generator (`npm run docs` to generate `/docs`)

BREAKING
--------
  * Rewrite Agenda API support promises! ([#557](https://github.com/agenda/agenda/pull/557))

    No more callbacks! Instead of:

    ```js
    function graceful() {
      agenda.stop(function() {
        process.exit(0);
      });
    }
    ```

    You need to:
    ```js
    async function graceful() {
      await agenda.stop();
      process.exit(0);
    }
    ```

    You don't anymore have to listen for `start` event. Instead you can do:
    ```js
    await agenda.start();
    agenda.every('10 minutes', 'example');
    ```

    However, this will still work:
    ```js
    agenda.on('ready', function () {
      agenda.every('10 minutes', 'example');
      agenda.start();
    });
    ```

    See the documentation for more!

  * Drop support for Node.js versions 4, 5 and 6 ([#557](https://github.com/agenda/agenda/pull/557) / [#608](https://github.com/agenda/agenda/pull/608))
  * Drop support for MongoDB 2.4 ([#497](https://github.com/agenda/agenda/pull/497))
  * Update Native MongoDB driver to 3.1 from 2.2 ([#616](https://github.com/agenda/agenda/pull/616))
  * Jobs _emit_ errors instead of throwing them

1.0.3 / 2017-10-17
==================
  * Update dependencies ([2854c7e](https://github.com/agenda/agenda/commit/65159172b34b9a1344814619c117474bcc323f8d))

1.0.2 / 2017-10-17
==================
  * Update dependencies ([2854c7e](https://github.com/agenda/agenda/commit/2854c7e3847cc8aecea702df8532789c51b1ed30))

1.0.1 / 2017-10-10
==================
  * Update dependencies `cron` and `debug` ([#505](https://github.com/agenda/agenda/pull/505))

1.0.0 / 2017-08-12
==================

* Gracefully recover from losing connection to MongoDB ([#472](https://github.com/agenda/agenda/pull/472))
* Code cleanup ([#492](https://github.com/agenda/agenda/pull/492))

BREAKING
--------
  * Fix jobs not running in order of them being queued ([#464](https://github.com/agenda/agenda/pull/464))

  * Changes in Cron string parsing, changed parsing library from [ncb000gt/node-cron](https://www.npmjs.com/package/cron) to [harrisiirak/cron-parser](https://www.npmjs.com/package/cron-parser) ([#475](https://github.com/agenda/agenda/pull/475))

Previously Agenda would treat months as 0-11 where as normally, cron months are parsed as 1-12.

```
* * * * * *
| | | | | |
| | | | | +-- Year              (range: 1900-3000)
| | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
| | | +------ Month of the Year (range: 0-11) NOTE: Difference here
| | +-------- Day of the Month  (range: 1-31)
| +---------- Hour              (range: 0-23)
+------------ Minute            (range: 0-59)
```

Starting in version `1.0.0`, cron will be parsed in the standard UNIX style:
```
* * * * * *
| | | | | |
| | | | | +-- Year              (range: 1900-3000)
| | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
| | | +------ Month of the Year (range: 1-12) NOTE: Difference here
| | +-------- Day of the Month  (range: 1-31)
| +---------- Hour              (range: 0-23)
+------------ Minute            (range: 0-59)
```


0.10.2 / 2017-08-10
===================
  * Adds debugging, [see instructions from README.md](https://github.com/agenda/agenda#to-turn-on-logging-please-set-your-debug-env-variable-like-so).

0.10.1 / 2017-08-10
===================
  * Unpublished and re-published as v0.10.2

0.10.0 / 2017-08-08
==================
  * Replace the deprecated `findAndModify` method from native MongoDB driver to `findOneAndUpdate` ([#448](https://github.com/agenda/agenda/pull/448))
  * Going forward, we won't ensure Node.js v0.10 and v0.11 compatibility anymore ([#449](https://github.com/agenda/agenda/pull/449))
  * Code cleanup ([#491](https://github.com/agenda/agenda/pull/491), [#489](https://github.com/agenda/agenda/pull/489), [#488](https://github.com/agenda/agenda/pull/488), [#487](https://github.com/agenda/agenda/pull/487))

0.9.1 / 2017-03-22
==================

Republish release for NPM. Includes fixes from 0.9.0 release:

  * add support for `mongoose.connection` for `agenda.mongo()`, fixes #156
  * Fix for race condition in the afterEach clean up code (#355)
  * Fixes + protects against concurrency not being honored  (#379)


0.9.0 / 2016-12-28
==================
  * add support for `mongoose.connection` for `agenda.mongo()`, fixes #156
  * Fix for race condition in the afterEach clean up code (#355)
  * Fixes + protects against concurrency not being honored  (#379)
  * Bump mongodb dep version to support ssl conns (#368)
  * Increase Mongo compatability to 2.4

0.8.1 / 2016-05-08
==================

  * Add Node v6 to CI
  * 1. Update dev dependencies for out of date. 2. Small fix to job.js for invalid repeatAt
  * Update .npmignore
  * Fix doc: cb not marked as optional (closes #279)
  * Including nextRunAt check in query for on the fly lock.
  * Picking up any job with an expired lock (not just recurring or queued).
  * Fixed failing test
  * throw on processJobResult error
  * Requeuing concurrency blocked jobs wrt priority.
  * Processing the next job that is not blocked by concurrency.
  * Fix test which fails only sometimes
  * Add agendash as alternative ui
  * Merge pull request #288 from diesal11/master

0.8.0 / 2016-02-21
==================

  * Implementing lock limit
  * Use callback to handle errors if we can.

0.7.9 / 2016-02-05
==================

  * fix: ReferenceError: MongoError is not defined

0.7.8 / 2016-02-03
==================

  * fix: computeNextRunAt timezone bug

0.7.7 / 2016-01-25
==================

  * feat: add timezone option for repeatAt.
  * fix: job locking logic
  * fix: bug with jobs expiring and being enqueued anyway
  * fix: bug where jobs wouldn't run concurrently
  * fix: agenda throwing an exception when starting a job defined on another instance
  * fix: possible bug when using extended Array.prototype

0.7.6 / 2016-01-04
==================

  * feat: Add failCount attribute to jobs
  * fix: job priority for on the fly job lock and queueing is now respected
  * fix: make agenda.cancel no longer require a callback
  * fix: stale jobs running after a more up-to-date job has completed
  * fix: fail/success event emit after jobs have been saved in the database
  * fix: ready event when using config.mongo

0.7.5 / 2015-12-05
==================

  * Adds options.insertOnly to job.unique that prevents the job from being updated multiple times on multiple runs

0.7.4 / 2015-11-26
==================

  * fix job priority scheduling

0.7.3 / 2015-11-22
==================

  * add support for success callbacks on schedule, every and now (@mgregson)
  * using self for reference to collection (@3choBoomer)
  * emit ready from db_init (@jdiamond)

0.7.2 / 2015-10-22
==================

  * Rollback job completion callback to pre-0.7.0
  * Emit events when Agenda init is ready or has failed

0.7.0 / 2015-09-29
==================

  * Switch from mongoskin to mongodb native. Big thanks to the
  [classdojo](http://classdojo.com) team for this. Shoutouts to @liamdon,
  @jetzhou and @byronmwong for the help!

0.6.28 / 2015-02-13
==================

  * Fix for when _findAndLockNextJob returns multiple jobs.

0.6.27 / 2015-02-04
==================

 * code cleanup, fix leaking ignoreErrors

0.6.26 / 2014-11-30
==================

  * fix double run bug

0.6.25 / 2014-11-20
==================

 * Allow specifying mongo config (optionally)

0.6.24 / 2014-10-31
==================

 * Fix .every() running when using cron strings.

0.6.23 / 2014-10-25
==================

 * Remove debugger

0.6.22 / 2014-10-22
==================

 * add job.unique (@nwkeeley)

0.6.21 / 2014-10-20
==================

 * Re-add tests for those who use the `npat` option.

0.6.20 / 2014-10-14
==================

 * add job.disable() and job.enable()
 * Added .npmignore for test/ build scripts.

0.6.19 / 2014-09-03
==================

 * Create database indexes when initializing Agenda instance (@andyneville)

0.6.18 / 2014-08-16
==================

 * Implemented job.isRunning()
 * Fixed issue where jobs would continue being processed after agenda is explicitly stopped
 * Fixed complete event being emitted before asynchronous jobs are finished

0.6.17 / 2014-08-11
==================

 * add job.repeatAt

0.6.16 / 2014-06-16
==================

 * fix job queue being processed even when agenda was stopped
 * fix agenda.every method

0.6.15 / 2014-06-11
==================

 * fix agenda.every overwriting nextRunAt [closes #70]

0.6.14 / 2014-06-06
==================

 * Added agenda.cancel function
 * Fix more circumstances where jobs re-create after remove

0.6.13 / 2014-06-01
==================

 * fix jobs resaving after remove [closes #66]
 * fix jobs skipping in line from database querying

0.6.12/ 2014-05-22
==================

 * update saveJob to allow for pre-set Ids [closes #64]

0.6.11/ 2014-05-19
==================

 * add job.touch to reset lock lifetime [references #63]

0.6.10 / 2014-05-13
==================

 * make job saving use agenda._name

0.6.9 / 2014-05-13
==================

 * add agenda.name config method
 * fix agenda.mongo not being chainable

0.6.8 / 2014-05-06
==================

 * add graceful job unlocking to stop

0.6.7 / 2014-04-21
==================

 * Implement, document, and test defaultLockLifetime [@shakefu]

0.6.6 / 2014-04-21
==================

 * Bump date.js version [@psema4]

0.6.5 / 2014-04-17
==================

 * mongoskin version bump (better support for mongodb 2.6) [@loginx]

0.6.4 / 2014-04-09
==================

 * fix $setOnInsert with empty obj cause mongodb 2.6 complain [@inetfuture]

0.6.3 / 2014-04-07
==================

 * fix cron-jobs executing multiple times
 * fail the job if repeat interval is wrong

0.6.2 / 2014-03-25
==================

 * fix bug that resulted in jobs scheduled in memory to always re-run
 * Update mongoskin to 1.3

0.6.1 / 2014-03-24
==================

 * allow every and schedule to take array of job names

0.6.0 / 2014-03-21 (NO BREAKING CHANGES)
==================

 * convert to using setTimeout for precise job scheduling [closes #6]

0.5.10/ 2014-03-20
==================

 * fix agenda.every not properly saving jobs
 * improve instantiating jobs, fixes bug where certain attrs weren't loaded in

0.5.9 / 2014-03-10
==================

 * add job#remove method

0.5.8 / 2014-03-07
==================

 * Fixed single jobs not being saved properly [closes #38]

0.5.7 / 2014-03-06
==================

 * fix every re-running jobs out of queue at load

0.5.6 / 2014-02-18
==================

 * Added failing for jobs with undefined definitions
 * Added agenda.purge() to remove old jobs

0.5.5 / 2014-01-28
==================

 * added support to directly give mongoskin object, to help minimize connections

0.5.4 / 2014-01-09
==================

 * Added start event to jobs. (@clayzermki)

0.5.3 / 2014-01-06
==================

 * Added agenda.now method

0.5.2 / 2014-01-06
==================

 * Added ability for job.fail to take an error

0.5.1 / 2013-01-04 (Backwards compatible!)
==================
 * Updated version of humanInterval, adding weeks and months support

0.5.0 / 2013-12-19 (Backwards compatible!)
==================

 * Added job locking mechanism, enabling support for multiple works / agenda instances (@bars3s)

0.4.4 / 2013-12-13
==================

 * fix job.toJson method: add failReason & failedAt attrs (Broken in 0.4.3 and 0.4.2)
 * fix job cb for working with 'q' promises

0.4.3 / 2013-12-13
==================

 * fix job.schedule's taking Date object as 'when' argument [@bars3s]

0.4.2 / 2013-12-11
==================

 * Refactored Job to ensure that everything is stored as an ISODate in the Database. [Closes #14] [@raisch]

0.4.1 / 2013-12-10
==================

 * Added support for synchronous job definitions

0.4.0 / 2013-12-04
==================

 * Added Cron Support [Closes #2]
 * removed modella dependency

0.3.1 / 2013-11-19
==================

 * Fix for setImmediate on Node 0.8

0.3.0 / 2013-11-19
==================

 * Added Events to the Event Queue [References #7]

0.2.1 / 2013-11-14
==================

 * Fixed a bug where mongo wasn't giving updated document

0.2.0 / 2013-11-07
==================

 * Added error for running undefined job. [Closes #4]
 * Fixed critical error where new jobs are not correctly saved.

0.1.3 / 2013-11-06
==================

 * Small Bug fix for global-namespace pollution

0.1.2 / 2013-10-31
==================

 * Updated write concern to avoid annoying notices

0.1.1 / 2013-10-28
==================

  * Removed unecessary UUID code

0.1.0 / 2013-10-28
==================

  * Initial Release
