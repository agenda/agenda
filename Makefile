test:
	NODE_ENV=test mocha -w --reporter spec

test-coverage:
	NODE_ENV=test AGENDA_COVERAGE=1 mocha test --require blanket --reporter html-cov > coverage.html

.PHONY: test test-coverage
