# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
