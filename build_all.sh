#!/bin/sh

docker build --tag="tim" timApp
cd Ephemeral
./install.sh
cd ..
docker build --tag="haskellplugins" timApp/modules/Haskell
docker build --tag="cs3" timApp/modules/cs
docker build --tag="svn" timApp/modules/svn
