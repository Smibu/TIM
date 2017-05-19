#!/bin/sh
cd /cs
# Set locale
export LANG=en_US.UTF-8
 
# For X server emulation
Xvfb :1 -screen 0 1280x1024x24 &
export DISPLAY=:1

# Copy Jypeli dll's to temp directory
# cp /cs/jypeli/* /tmp/cs

# Gets are moved to startPlugins.sh

# Get Jypeli
#mkdir /cs/jypeli
#cd /cs/jypeli
#curl http://kurssit.it.jyu.fi/npo/MonoJypeli/TIM/Jypeli.headless.tar.gz | tar -xz

# Get ComTest 
#cd /tmp
#rm -f ComTest.jar*
#wget https://svn.cc.jyu.fi/srv/svn/comtest/proto/tojukarp/trunk/dist/ComTest.jar
#cd /cs/java
#rm -f comtest*.jar*
#wget https://svn.cc.jyu.fi/srv/svn/comtest/proto/vesa/trunk/comtest.jar
#wget https://svn.cc.jyu.fi/srv/svn/comtest/proto/vesa/trunk/comtestcpp.jar
#
#rm -f Graphics.jar*
#wget https://svn.cc.jyu.fi/srv/svn/ohj1/graphics/trunk/Graphics.jar
#rm -f Ali*.jar
#wget https://svn.cc.jyu.fi/srv/svn/ohj2/Ali/trunk/Ali.jar

cd /cs
export CLASSPATH=.:/cs/java/junit.jar:/cs/java/hamcrest-core.jar:/cs/java/comtest.jar:/cs/java/Ali.jar:/cs/java/Graphics.jar:/cs/java/fxgui.jar:/cs/java/gui.jar
export MONO_PATH=/cs/jypeli

# Run the server as agent
su -p - agent -c 'python3 -O /cs/cs3.py'

 
