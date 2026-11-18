Parcourez les fichiers de votre serveur FTP et automatisez les transferts depuis Homey. Enregistrez des captures de caméra, envoyez des rapports vers votre NAS ou mettez des fichiers audio à disposition d’un lecteur compatible.

• Gérez vos fichiers dans Homey : envoyez et téléchargez des fichiers, créez des dossiers, renommez, déplacez ou supprimez des fichiers et des dossiers.
• Automatisez avec Flow : enregistrez des images ou des fichiers encodés en base64, obtenez une liste de fichiers en JSON, chargez des images dans vos Flows ou créez un lien de téléchargement temporaire.
• Enregistrez des fichiers depuis des URL : transférez les téléchargements HTTP, HTTPS ou FTP vers votre serveur, y compris les liens d’export de Simple (Sys) Log, sans faire passer le fichier par un jeton Flow.
• Prise en charge de Simple (Sys) Log : enregistrez les exports CSV, Excel ou JSON avec la carte d’export dédiée, ou reliez sa carte d’URL d’export à « Enregistrer un fichier depuis une URL » pour les journaux volumineux.
• Surveillez la connexion : Homey vérifie automatiquement le dossier configuré. Déclenchez des Flows lorsque le serveur FTP devient indisponible, redevient accessible ou qu’un transfert échoue.

Ajoutez un appareil de type « Connexion FTP » et renseignez les paramètres du serveur. Lors de l’association, Homey essaie d’abord le FTP sécurisé (FTPS), puis le FTP non chiffré si nécessaire. Si vous choisissez un dossier de départ, la navigation et les opérations sur les fichiers dans les Flows restent limitées à ce dossier. Ouvrez l’écran de réparation de l’appareil pour parcourir vos fichiers dans l’app Homey ou l’app web.

Compatible avec les serveurs FTP, dont Micro Web Server.

Nécessite l’app Better Logic Library. Le code BLL est pris en charge dans les champs texte de nom de fichier et de chemin. Consultez les paramètres de l’app Better Logic Library pour savoir comment utiliser le code BLL.

Pour en savoir plus, consultez le sujet consacré à cette app sur le forum communautaire Homey.
Pour accéder au wiki et au guide d’utilisation de FTP Client, sélectionnez « Visiter le site web » sous « Site web du développeur », sur la page de cette app dans le Homey App Store.
