JS_COMPILER = \
	./lib/uglifyjs/bin/uglifyjs

all: \
	pixymaps.js \
	pixymaps.min.js

.INTERMEDIATE pixymaps.js: \
	src/start.js \
	src/index.js \
	src/cache.js \
	src/image.js \
	src/queue.js \
	src/url.js \
	src/view.js \
	src/end.js

%.min.js: %.js Makefile
	@rm -f $@
	$(JS_COMPILER) < $< > $@

pixymaps.js: Makefile
	@rm -f $@
	cat $(filter %.js,$^) > $@
	@chmod a-w $@

clean:
	rm -f pixymaps*.js
