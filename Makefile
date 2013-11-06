test:
	NODE_ENV=test mocha -w --reporter spec

test-once:
	NODE_ENV=test mocha --reporter spec

test-coverage:
	NODE_ENV=test AGENDA_COVERAGE=1 mocha test --require blanket --reporter html-cov > coverage.html

test-coveralls:
	$(MAKE) test-once
	NODE_ENV=test AGENDA_COVERAGE=1 mocha test --require blanket --reporter mocha-lcov-reporter | ./node_modules/coveralls/bin/coveralls.js

.PHONY: test test-coverage test-coveralls
