# SPORT LIVE — PWA starter

Prototype web-app installable depuis Safari sur iPhone. Interface française, responsive, filtres Padel/PSG/F1, cartes d'événements, fichier .ics d'exemple, service worker et manifeste PWA.

## Important
Les événements et statuts sont des exemples d'interface. Aucun score, horaire, classement, chaîne ou actualité en direct n'est fourni à ce stade. Ne pas présenter ces données comme réelles.

## Installation sur iPhone
1. Héberger le contenu de ce dossier sur un site HTTPS (par exemple un hébergement statique).
2. Ouvrir l'adresse dans Safari sur l'iPhone.
3. Toucher Partager → Sur l'écran d'accueil → Ajouter.

## Étapes indispensables avant usage réel
- Ajouter un backend sécurisé pour agréger des fournisseurs autorisés pour Premier Padel/FIP, football et F1.
- Ne jamais placer de clés API secrètes dans app.js.
- Définir les droits d'utilisation des scores, photos, logos, actualités et données de diffusion.
- Ajouter un service push compatible Web Push pour les notifications distantes. La permission seule ne crée pas de notifications automatiques.
- Le bouton calendrier télécharge un fichier ICS d'exemple; le vrai calendrier devra être alimenté par les horaires officiels. iOS peut demander confirmation pour l'ajout.

## Stack
HTML/CSS/JavaScript vanilla, manifest PWA, service worker. Aucun framework ni clé API.