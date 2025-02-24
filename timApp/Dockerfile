FROM ubuntu:20.04

ENV APT_INSTALL="DEBIAN_FRONTEND=noninteractive apt-get -qq update && DEBIAN_FRONTEND=noninteractive apt-get -q install --no-install-recommends -y" \
    APT_CLEANUP="rm -rf /var/lib/apt/lists /dvisvgm-2.4 /usr/share/doc ~/.cache"

# Configure timezone and locale
RUN bash -c "${APT_INSTALL} locales tzdata && ${APT_CLEANUP}"
RUN locale-gen en_US.UTF-8 && bash -c "${APT_CLEANUP}"
ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8
RUN echo "Europe/Helsinki" > /etc/timezone; dpkg-reconfigure -f noninteractive tzdata && bash -c "${APT_CLEANUP}"

# Install dependencies of texlive-full excluding packages that are not needed (such as documentation files).
# This almost-full installation of TeX Live is needed for the latex-pdf printing functionality, as
# TeX Live doesn't have an (MiKTeX/MacTeX-esque) auto-install functionality for missing LaTeX packages,
# i.e. the whole package archive needs to be pre-installed or the set of usable packages needs to be
# severely limited.
RUN bash -c "${APT_INSTALL} \
biber \
ca-certificates \
cm-super \
dvidvi \
dvipng \
feynmf \
fonts-texgyre \
fragmaster \
latex-cjk-all \
latexmk \
lcdf-typetools \
lmodern \
psutils \
purifyeps \
software-properties-common \
t1utils \
tex-gyre \
texlive-base \
texlive-bibtex-extra \
texlive-binaries \
texlive-extra-utils \
texlive-font-utils \
texlive-fonts-extra \
texlive-fonts-recommended \
texlive-formats-extra \
texlive-games \
texlive-humanities \
texlive-lang-arabic \
texlive-lang-chinese \
texlive-lang-cjk \
texlive-lang-cyrillic \
texlive-lang-czechslovak \
texlive-lang-english \
texlive-lang-european \
texlive-lang-french \
texlive-lang-german \
texlive-lang-greek \
texlive-lang-italian \
texlive-lang-japanese \
texlive-lang-korean \
texlive-lang-other \
texlive-lang-polish \
texlive-lang-portuguese \
texlive-lang-spanish \
texlive-latex-base \
texlive-latex-extra \
texlive-latex-recommended \
texlive-luatex \
texlive-metapost \
texlive-music \
texlive-pictures \
texlive-pstricks \
texlive-publishers \
texlive-science \
texlive-xetex \
wget \
&& ${APT_CLEANUP}"

# Update dvisvgm so that it supports converting PDFs to SVGs
ENV DVISVGM_VERSION="2.12"
RUN bash -c "${APT_INSTALL} gcc g++ libgs-dev libkpathsea-dev pkg-config libfreetype6-dev make && ${APT_CLEANUP}"
RUN FILE=`mktemp`; wget "https://github.com/mgieseki/dvisvgm/releases/download/${DVISVGM_VERSION}/dvisvgm-${DVISVGM_VERSION}.tar.gz" -qO $FILE && \
 tar -xf $FILE && \
 cd dvisvgm-$DVISVGM_VERSION && \
 ./configure --enable-bundled-libs && \
 make -j4 && \
 make install && \
 cd / && \
 ${APT_CLEANUP} && \
 rm -rf /dvisvgm-$DVISVGM_VERSION

# Install Python, pip and other necessary packages

RUN bash -c "add-apt-repository -y ppa:deadsnakes/ppa && ${APT_CLEANUP}"
RUN bash -c "${APT_INSTALL} python3.10 python3.10-distutils && ${APT_CLEANUP}"

RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 20

# lxml dependencies
# C-parser for PyYAML
# python-magic dependency
# img2pdf w/ python lib
RUN bash -c "${APT_INSTALL} \
 git-core \
 img2pdf \
 libffi-dev \
 libmagic1 \
 libmagickwand-dev \
 libvoikko1 \
 libxml2-dev \
 libxmlsec1-dev \
 libxmlsec1-openssl \
 libxslt-dev \
 libyaml-dev \
 python3.10-dev \
 voikko-fi \
 zlib1g-dev \
 && ${APT_CLEANUP}"

RUN wget -q https://bootstrap.pypa.io/get-pip.py && python3.10 get-pip.py && rm get-pip.py

# Install xmlsec binary which is needed for PySAML2
RUN bash -c "${APT_INSTALL} xmlsec1 && ${APT_CLEANUP}"

ENV PIP_INSTALL="python3.10 -m pip install"
RUN bash -c "${PIP_INSTALL} --upgrade poetry==1.2.1 requests && ${APT_CLEANUP}"

COPY pyproject.toml poetry.lock ./
RUN bash -c " \
poetry config virtualenvs.create false && \
poetry config virtualenvs.in-project false && \
poetry install --without dev && \
${APT_CLEANUP} && \
rm pyproject.toml poetry.lock"

# Install Pandoc
RUN FILE=`mktemp`; wget "https://github.com/jgm/pandoc/releases/download/2.14.2/pandoc-2.14.2-1-amd64.deb" -qO $FILE && \
 dpkg -i $FILE && rm $FILE && bash -c "${APT_CLEANUP}"

# Set name and email for git.
RUN git config --global user.email "agent@docker.com" && git config --global user.name "agent"
RUN git config --global --add safe.directory '*'

RUN mkdir /service

# Add user `agent` -- we don't want to run anything as root.
RUN useradd -M agent
RUN chown -R agent /service

RUN bash -c "${APT_INSTALL} curl qpdf gpg-agent poppler-utils && ${APT_CLEANUP} && \
    curl --version && qpdf --version"

# On current TIM production server, using latest versions of Node and NPM will cause
# ./npmi and ./js scripts to fail, causing the following symptoms:
#
# * ./npmi simply freezes right away, consuming memory until an out of memory exception is thrown.
# * ./js does not freeze, but it throws a permission error after building scripts when trying to copy them to the final
#   output directory.
#
# It has not yet been investigated whether it's because of Node or NPM update.
RUN (curl -sL https://deb.nodesource.com/setup_16.x | bash -) && bash -c "${APT_INSTALL} nodejs && ${APT_CLEANUP}"
RUN npm i npm@6 -g && bash -c "${APT_CLEANUP}"

# Flask-Testing does not let us configure host, so we do it here.
RUN sed -i "s/port=port, use_reloader=False/host='0.0.0.0', port=port, use_reloader=False/" /usr/local/lib/python3.10/dist-packages/flask_testing/utils.py
# Fix newest Werkzeug incompatibility
RUN sed -i "s/from werkzeug import cached_property/from werkzeug.utils import cached_property/" /usr/local/lib/python3.10/dist-packages/flask_testing/utils.py

RUN wget -q http://mirrors.ctan.org/support/latexmk/latexmk.pl -O /usr/bin/latexmk

# Chromedriver (for running tests)
# Taken from https://github.com/SeleniumHQ/docker-selenium/blob/trunk/NodeChrome/Dockerfile
ARG CHROME_VERSION="google-chrome-stable"
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update -qqy \
  && apt-get -qqy install unzip \
    ${CHROME_VERSION:-google-chrome-stable} \
  && rm /etc/apt/sources.list.d/google-chrome.list \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

RUN wget -q https://raw.githubusercontent.com/SeleniumHQ/docker-selenium/trunk/NodeChrome/wrap_chrome_binary -O /usr/local/bin/wrap_chrome_binary && chmod +x /usr/local/bin/wrap_chrome_binary
RUN /usr/local/bin/wrap_chrome_binary

ARG CHROME_DRIVER_VERSION
RUN if [ -z "$CHROME_DRIVER_VERSION" ]; \
  then CHROME_MAJOR_VERSION=$(google-chrome --version | sed -E "s/.* ([0-9]+)(\.[0-9]+){3}.*/\1/") \
    && CHROME_DRIVER_VERSION=$(wget --no-verbose -O - "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_MAJOR_VERSION}"); \
  fi \
  && echo "Using chromedriver version: "$CHROME_DRIVER_VERSION \
  && wget --no-verbose -O /tmp/chromedriver_linux64.zip https://chromedriver.storage.googleapis.com/$CHROME_DRIVER_VERSION/chromedriver_linux64.zip \
  && rm -rf /opt/selenium/chromedriver \
  && unzip /tmp/chromedriver_linux64.zip -d /opt/selenium \
  && rm /tmp/chromedriver_linux64.zip \
  && mv /opt/selenium/chromedriver /opt/selenium/chromedriver-$CHROME_DRIVER_VERSION \
  && chmod 755 /opt/selenium/chromedriver-$CHROME_DRIVER_VERSION \
  && ln -fs /opt/selenium/chromedriver-$CHROME_DRIVER_VERSION /usr/bin/chromedriver

RUN bash -c "${APT_INSTALL} ripgrep && ${APT_CLEANUP}"

WORKDIR /service

CMD python3 launch.py

EXPOSE 5000
EXPOSE 5001