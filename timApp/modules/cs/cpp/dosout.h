/* dosout.h  */
/****************************************************************************/
/*
**       D O S O U T . H
**
** Muuttaa cout tietovirran sellaiseksi ett� koodisivun 1252 �:t tulostetaan
** koodisivun 850 (OEM) mukaan.
**
**  Tekij�t:          Vesa Lappalainen
**  Tehty:            17.02.2001
**  Komentit ja p�ivityshistoria ks. dout.cpp
**
*****************************************************************************/
#ifdef __TURBOC__
#ifndef __DOSOUT_H
#define __DOSOUT_H

#include <iostream>

#define cout dout
#define getline dgetline
#include "dout.h"

#endif /* __DOSOUT_H    */
#endif /* __MSDOS__ */
