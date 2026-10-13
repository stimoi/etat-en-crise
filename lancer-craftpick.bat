@echo off
rem =====================================================================
rem  lancer-craftpick.bat - Double-clique pour jouer avec l'IA CRAFTPICK
rem  (serveur distant, reglages CRAFTPICK_... du fichier .env).
rem
rem  Ce fichier prepare tout (Node, dependances, .env) puis lance
rem  scripts\lancer-craftpick.js, qui verifie l'API et ouvre le jeu.
rem  Pour arreter : ferme cette fenetre ou appuie sur Ctrl+C.
rem =====================================================================

rem Affichage des accents dans la fenetre
chcp 65001 >nul
setlocal
rem On se place dans le dossier du jeu, quel que soit l'endroit d'ou on lance
cd /d "%~dp0"
title L'Etat en crise - IA CraftPick

call :preparer
if errorlevel 1 goto fin

rem Ouvre le navigateur tout seul (mettre OUVRIR_NAVIGATEUR=0 pour ne pas le faire)
if not defined OUVRIR_NAVIGATEUR set "OUVRIR_NAVIGATEUR=1"
node scripts\lancer-craftpick.js
goto fin


rem ---------------------------------------------------------------------
rem  Preparation commune : Node.js, dependances, fichier .env
rem ---------------------------------------------------------------------
:preparer
rem 1. Node.js : dans le PATH, sinon dans le dossier ou il a ete installe
where node >nul 2>nul
if not errorlevel 1 goto node_ok
if not exist "C:\npm\node-v24.18.0-win-x64\node.exe" goto node_absent
set "PATH=C:\npm\node-v24.18.0-win-x64;%PATH%"
:node_ok

rem 2. Dependances (Express) : installees une seule fois
if exist "node_modules\" goto dependances_ok
echo Installation des dependances (premiere fois seulement)...
call npm install
if errorlevel 1 goto erreur_npm
:dependances_ok

rem 3. Fichier .env : cree a partir du modele s'il n'existe pas
if exist ".env" exit /b 0
copy ".env.example" ".env" >nul
echo Fichier .env cree a partir de .env.example : verifie la partie CraftPick.
exit /b 0

:node_absent
echo [ERREUR] Node.js est introuvable.
echo Installe-le depuis https://nodejs.org puis relance ce fichier.
exit /b 1

:erreur_npm
echo [ERREUR] L'installation des dependances a echoue (connexion internet ?).
exit /b 1


:fin
echo.
echo Le jeu est arrete.
pause
