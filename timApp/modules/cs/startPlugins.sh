#!/usr/bin/env bash
# Start csplugin

if [ "$2" != "p" ]
then

#setfacl  -R -d -m m::rwx -m group::rwx -m other::rwx /tmp

if [ ! -d MIRToolbox ]; then
    echo "GET MIR"
    mkdir MIRToolbox
    cd MIRToolbox
    rm -rf *

    #Here we download MIRToolbox:
    git clone https://github.com/martinarielhartmann/mirtooloct .
    #To reduce the size of the folder a bit:
    cd mirtooloct
    rm -rf *.pdf
fi

if [ ! -d static/glowscript ]; then
    echo "GET GlowScript"
    git clone https://github.com/BruceSherwood/glowscript static/glowscript
fi

mkdir -p /tmp/cache
chown -R agent:agent /tmp
rm /tmp/cache/* > /dev/null 2>&1

chown -R agent:agent /csgenerated

touch /cs/log.txt
chown agent:agent /cs/log.txt

# Oikeudet käyttää dockeria niin saadaan docker in docker
chmod 766 /var/run/docker.sock

# Copy Jypeli dll's  
cd /cs/jypeli
curl https://kurssit.it.jyu.fi/npo/MonoJypeli/TIM/Jypeli.headless.tar.gz | tar -xz --overwrite --warning=none

cd /cs/java
wget https://svn.cc.jyu.fi/srv/svn/comtest/proto/vesa/trunk/comtest.jar -O comtest.jar.tmp -nv && mv comtest.jar.tmp comtest.jar
wget https://svn.cc.jyu.fi/srv/svn/comtest/proto/vesa/trunk/comtestcpp.jar -O comtestcpp.jar.tmp -nv && mv comtestcpp.jar.tmp comtestcpp.jar
wget https://svn.cc.jyu.fi/srv/svn/ohj1/graphics/trunk/Graphics.jar -O Graphics.jar.tmp -nv && mv Graphics.jar.tmp Graphics.jar
wget https://svn.cc.jyu.fi/srv/svn/ohj2/Ali/trunk/Ali.jar -O Ali.jar.tmp -nv && mv Ali.jar.tmp Ali.jar
wget https://svn.cc.jyu.fi/srv/svn/ohj2/FXExamples/trunk/FXGui/fxgui.jar -O fxgui.jar.tmp -nv && mv fxgui.jar.tmp fxgui.jar
wget https://svn.cc.jyu.fi/srv/svn/ohj2/gui/gui.jar -O gui.jar.tmp -nv && mv gui.jar.tmp gui.jar

mkdir -p cs
cd cs
wget https://svn.cc.jyu.fi/srv/svn/comtest/proto/tojukarp/trunk/dist/ComTest.jar -O ComTest.jar.tmp -nv && mv ComTest.jar.tmp ComTest.jar

cd /cs/simcir/check
wget https://yousource.it.jyu.fi/opetus-ji/logik-py/blobs/raw/master/simcirtest.py -O simcirtest.py.tmp -nv && mv simcirtest.py.tmp simcirtest.py

fi

cd /cs

./startAll.sh
