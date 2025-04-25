require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const fetch = require("node-fetch");

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'guilds', 'guilds.members.read']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const guildId = process.env.GUILD_ID;

    const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error("❌ Erreur récupération membre : ", await response.text());
      return done(null, profile);
    }

    const guildMember = await response.json();
    profile.guild_member = guildMember;

    return done(null, profile);
  } catch (err) {
    console.error("❌ Erreur dans la stratégie Discord :", err);
    return done(err, null);
  }
}));

// 👇 Bloque toute requête vers / sans /login
app.get('/', (req, res) => {
  res.status(403).send("Accès interdit.");
});

// 👇 Protection anti accès direct à /callback
app.get('/callback', (req, res, next) => {
  if (!req.query.code) {
    return res.status(403).send('Accès interdit.');
  }
  next();
}, passport.authenticate('discord', { failureRedirect: '/' }),
(req, res) => res.redirect('/protected')
);

app.get('/login', passport.authenticate('discord'));

function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/login');

  const member = req.user.guilds.find(g => g.id === process.env.GUILD_ID);
  const hasRole = req.user.guild_member?.roles.includes(process.env.REQUIRED_ROLE_ID);

  if (!member || !hasRole) return res.send("Accès refusé : Vous n'avez pas le rôle requis.");
  next();
}

app.get('/protected', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 👇 Sert les fichiers statiques (CSS/JS/images) uniquement pour les routes valides
app.use('/public', express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Serveur en ligne sur http://localhost:${PORT}`));
