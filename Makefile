#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

#
# Copyright 2021 Joyent, Inc.
# Copyright 2023 MNX Cloud, Inc.
#

#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

NAME		:= workflow

#
# Tools
#
TAP		:= ./node_modules/.bin/tap
TAR = tar
UNAME := $(shell uname)

ifeq ($(UNAME), SunOS)
	TAR = gtar
endif

#
# Files
#
DOC_FILES	 = index.md api.md workflow.md
EXTRA_DOC_DEPS += deps/restdown-brand-remora/.git
RESTDOWN_FLAGS   = --brand-dir=deps/restdown-brand-remora
JS_FILES	:= $(shell ls *.js) $(shell find lib -name '*.js')
ESLINT_FILES     = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -o indent=4,doxygen,unparenthesized-return=0
SMF_MANIFESTS_IN = smf/manifests/wf-api.xml.in smf/manifests/wf-runner.xml.in smf/manifests/wf-backfill.xml.in

NODE_PREBUILT_VERSION=v6.17.1

ifeq ($(shell uname -s),SunOS)
	NODE_PREBUILT_TAG=zone64
	# minimal-64-lts@21.4.0
	NODE_PREBUILT_IMAGE = a7199134-7e94-11ec-be67-db6f482136c2
endif

ENGBLD_USE_BUILDIMAGE	= true
ENGBLD_REQUIRE		:= $(shell git submodule update --init deps/eng)
include ./deps/eng/tools/mk/Makefile.defs
TOP ?= $(error Unable to access eng.git submodule Makefiles.)

BUILD_PLATFORM  = 20210826T002459Z

ifeq ($(shell uname -s),SunOS)
	include ./deps/eng/tools/mk/Makefile.node_prebuilt.defs
	include ./deps/eng/tools/mk/Makefile.agent_prebuilt.defs
else
	NPM := $(shell which npm)
	NPM_EXEC=$(NPM)
endif
include ./deps/eng/tools/mk/Makefile.smf.defs

#
# Repo-specific targets
#
.PHONY: all
all: build

.PHONY: build
build: $(SMF_MANIFESTS) | $(TAP) sdc-scripts
	$(NPM) install

$(TAP): | $(NPM_EXEC)
	$(NPM) install

CLEAN_FILES += $(TAP) ./node_modules/tap


ROOT                    := $(shell pwd)
RELEASE_TARBALL         := $(NAME)-pkg-$(STAMP).tar.gz
RELSTAGEDIR             := /tmp/$(NAME)-$(STAMP)

BASE_IMAGE_UUID = 04a48d7d-6bb5-4e83-8c3b-e60a99e0f48f
BUILDIMAGE_NAME = $(NAME)
BUILDIMAGE_DESC	= SDC Workflow
BUILDIMAGE_DO_PKGSRC_UPGRADE = true
BUILDIMAGE_PKGSRC = apg-2.3.0bnb10
AGENTS		= amon config registrar

.PHONY: setup
setup: | $(NPM_EXEC)
	$(NPM) install && $(NPM) update

.PHONY: release
release: build docs
	@echo "Building $(RELEASE_TARBALL)"
	@mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/workflow
	@mkdir -p $(RELSTAGEDIR)/site
	@touch $(RELSTAGEDIR)/site/.do-not-delete-me
	@mkdir -p $(RELSTAGEDIR)/root
	@mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/workflow/ssl
	cp -r $(ROOT)/etc \
		$(ROOT)/lib \
		$(ROOT)/wf-api.js \
		$(ROOT)/wf-runner.js \
		$(ROOT)/wf-console.js \
		$(ROOT)/wf-backfill.js \
		$(ROOT)/node_modules \
		$(ROOT)/package.json \
		$(ROOT)/sapi_manifests \
		$(ROOT)/smf \
		$(RELSTAGEDIR)/root/opt/smartdc/workflow/
	mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/boot
	cp -R $(ROOT)/deps/sdc-scripts/* $(RELSTAGEDIR)/root/opt/smartdc/boot/
	cp -R $(ROOT)/boot/* $(RELSTAGEDIR)/root/opt/smartdc/boot/
	# Copy the node build, then trim out the bits we don't need.
	mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/build
	cp -PR \
		$(ROOT)/build/node \
		$(ROOT)/build/docs \
		$(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/build
	# Trim node
	rm -rf \
		$(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/build/node/bin/npm \
		$(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/build/node/lib/node_modules \
		$(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/build/node/include \
		$(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/build/node/share
	# Trim node_modules (this is death of a 1000 cuts, try for some
	# easy wins).
	find $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/node_modules -name test | xargs -n1 rm -rf
	find $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/node_modules -name tests | xargs -n1 rm -rf
	find $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/node_modules -name examples | xargs -n1 rm -rf
	find $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/node_modules -name "draft-*" | xargs -n1 rm -rf  # draft xml stuff in json-schema
	find $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/node_modules -name libusdt | xargs -n1 rm -rf  # dtrace-provider
	find $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/node_modules -name obj.target | xargs -n1 rm -rf  # dtrace-provider
	# Create the release tarball.
	(cd $(RELSTAGEDIR) && $(TAR) -I pigz -cf $(ROOT)/$(RELEASE_TARBALL) root site)
	@rm -rf $(RELSTAGEDIR)


.PHONY: publish
publish: release
	mkdir -p $(ENGBLD_BITS_DIR)/$(NAME)
	cp $(ROOT)/$(RELEASE_TARBALL) $(ENGBLD_BITS_DIR)/$(NAME)/$(RELEASE_TARBALL)


include ./deps/eng/tools/mk/Makefile.deps
ifeq ($(shell uname -s),SunOS)
	include ./deps/eng/tools/mk/Makefile.node_prebuilt.targ
	include ./deps/eng/tools/mk/Makefile.agent_prebuilt.targ
endif
include ./deps/eng/tools/mk/Makefile.smf.targ
include ./deps/eng/tools/mk/Makefile.targ

sdc-scripts: deps/sdc-scripts/.git
