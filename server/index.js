import express from 'express'
import http from 'http'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import passport from 'passport'
import session from 'express-session'
import connectMongo from 'connect-mongodb-session'

import { buildContext } from 'graphql-passport'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { mergedResolvers } from './resolvers/index.js'
import { mergedTypeDefs } from './typeDefs/index.js'
import { configurePassport } from './passport/index.js'

dotenv.config()

const PORT = process.env.PORT
configurePassport()
const app = express()
const httpServer = http.createServer(app)

const MongoDBstore = connectMongo(session)
const store = new MongoDBstore({
    uri: process.env.MONGO_URI,
    collection: 'session'
})

store.on('error', (err) => console.error(err))

app.use(
    session({
                secret: process.env.SESSION_SECRET,
		resave: false, // this option specifies whether to save the session to the store on every request
		saveUninitialized: false, // option specifies whether to save uninitialized sessions
		cookie: {
			maxAge: 1000 * 60 * 60 * 24 * 7,
			httpOnly: true, // this option prevents the Cross-Site Scripting (XSS) attacks
		},
		store: store,
    }),
    passport.initialize(),
    passport.session()
)

const server = new ApolloServer({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
})

// Ensure we wait for our server to start
await server.start()
const allowedOrigin = process.env.PRODUCTION_URL
app.use(
	"/graphql",
	cors({
		origin: allowedOrigin,
		credentials: true,
	}),
	express.json(),
	// expressMiddleware accepts the same arguments:
	// an Apollo Server instance and optional configuration options
	expressMiddleware(server, {
		context: async ({ req, res }) => buildContext({ req, res }),
	})
);
app.get('/test', (_, res) => res.send('Welcome to ApolloServer'))
mongoose
    .connect(process.env.MONGO_URI)
    .then((result) => console.log(`MongoDB Connected 🌐 ${result.connection.host}`))
    .then(() => httpServer.listen(PORT, () => console.log(`Server running on port: ${PORT} 🚀`)))
    .catch((error) => console.log(`❎ Server did not connect ⚠️\n${error}`))
