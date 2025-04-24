require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");

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
}, (accessToken, refreshToken, profile, done) => {
  process.nextTick(() => done(null, profile));
}));

app.get('/login', passport.authenticate('discord'));

app.get('/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/protected')
);

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

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Serveur en ligne sur http://localhost:${PORT}`));
