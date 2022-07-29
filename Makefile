deploy: | build-dir
	cp -L -r -t ./build ./index.html ./*.css ./*.js ./external; \
	aws s3 sync ./build s3://helios-playground

build-dir:
	mkdir -p ./build
