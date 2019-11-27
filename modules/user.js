'use strict'

const bcrypt = require('bcrypt-promise')
const fs = require('fs-extra')
const mime = require('mime-types')
const sqlite = require('sqlite-async')
const saltRounds = 10

/** 
 * Class that handles user operations.
 * */
class User {

    /**
     * Initialises database and adds 'users' table if it does not already exist
     * @constructor
     * @param {String} [dbName] - The name of the database. Defaults to :memory:
     * @returns {User} New instance of User class
     */
	constructor(dbName = ':memory:') {
		return (async() => {
			this.db = await sqlite.open(dbName)
			// we need this table to store the user accounts
			const sql = 'CREATE TABLE IF NOT EXISTS user (user_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, username VARCHAR (32) NOT NULL, password VARCHAR (60) NOT NULL, forename VARCHAR (32) NOT NULL, surname VARCHAR (32) NOT NULL, email VARCHAR (50) NOT NULL);'
			await this.db.run(sql)
			return this
		})()
	}

    /**
     * Register an user. This checks for existing entries for a given username
     * @param {String} username - The username of the new user.
     * @param {String} password - The password of the new user.
     * @param {String} forename - The forename of the new user.
     * @param {String} surname - The surname of the new user.
     * @param {String} email - The email of the new user.
     * @returns {Boolean} True on success, throws an error error on failure
     * @throws Will throw an error if operation fails and provide descriptive reasoning
     */
    async register(user, pass, forename, surname, email) {
        try {

            var patt1 = /[ ]/g; // exclude <these> characters from username and password
            if (user === '' || user.match(patt1) != null) throw new Error('Username can\'t be empty') //async ctx => ctx.redirect('/register?msg=invalid%20username.%20Enter%20correct%20Username') // new Error('Incorrect username') //return ctx.redirect('/register?msg=invalid%20username.%20Enter%20correct%20Username')
            if (pass === '' || pass.match(patt1) != null) throw new Error('Password can\'t be empty') //return ctx.redirect('/register?msg=invalid%20username.%20Password%20has%20to%20contain%20characters')
            if (forename.length === 0) throw new Error('missing forename')
            if (surname.length === 0) throw new Error('missing surname')
            if (email.length === 0) throw new Error('missing email')
            let sqlUser = `SELECT COUNT(user_id) as records FROM user WHERE username="${user}";`
            const dataUser = await this.db.get(sqlUser)
            if (dataUser.records !== 0) throw new Error(`username "${user}" already in use`)
            let sqlEmail = `SELECT COUNT(user_id) as records FROM user WHERE email="${email}";`
            const dataEmail = await this.db.get(sqlEmail)
            if (dataEmail.records !== 0) throw new Error(`email "${email}" already in use`)
            pass = await bcrypt.hash(pass, saltRounds)
            let sql = `INSERT INTO user(username, password, forename, surname, email) VALUES("${user}", "${pass}", "${forename}", "${surname}", "${email}")`
            await this.db.run(sql)
            return true
        } catch (err) {
            throw err
        }
    }

    /*async uploadPicture(path, mimeType) {
    	const extension = mime.extension(mimeType)
    	console.log(`path: ${path}`)
    	console.log(`extension: ${extension}`)
    	//await fs.copy(path, `public/avatars/${username}.${fileExtension}`)
    }*/

    /**
     * Login an user.
     * @param {String} username - The username of the new user.
     * @param {String} password - The password of the new user.
     * @returns {Boolean} True on success, throws an error error on failure
     * @throws Will throw an error if operation fails and provide descriptive reasoning
     */
    async login(email, password) {
        try {
            let sql = `SELECT count(user_id) AS count FROM user WHERE email="${email}";`
            const records = await this.db.get(sql)
            if (!records.count) throw new Error(`email "${email}" not found`)
            sql = `SELECT password FROM user WHERE email= "${email}";`
            const record = await this.db.get(sql)
            const valid = await bcrypt.compare(password, record.password)
            if (valid === false) throw new Error(`invalid password for account "${email}"`)
            return true
        } catch (err) {
            throw err
        }
    }
    async getUserData(email) {
        try {
            let sql = `SELECT * FROM user WHERE email= "${email}";`
            const record = await this.db.get(sql)
            return record
        } catch (err) {
            throw err
        }
    }
}
module.exports = User