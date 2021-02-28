
build-ci:
	# Build docker image for CI-CD purposes
	docker build -t ci-testing:latest .

ci: build-ci travis

travis:
	# Check if any JS or CSS file doesn't match the standard
	docker run --rm ci-testing:latest npx prettier --check .
	docker run --rm ci-testing:latest npx jshint js/
	@echo "✅️ SUCCESS"

format: build-ci
	# Format files to a specific style. Changes should be then git committed.
	docker run --rm -v ${PWD}:/app -u $(id -u ${USER}):$(id -g ${USER}) ci-testing:latest npx prettier --write .
	@echo "✅️ SUCCESS"

local-server:
	# Spin up a local server using PHP
	php -S 127.0.0.1:8080

local-python:
	# Spin up a local server using Python
	python -m SimpleHTTPServer 8080
