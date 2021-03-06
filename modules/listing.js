
'use strict'

const sqlite = require('sqlite-async')

/**
 * Class that handles listing operations.
 * */
class Listing {

	/**
     * Initialises database and adds 'item' and 'trade' tables if it does not already exist
     * @constructor
     * @param {String} [dbName] - The name of the database. Defaults to :memory:
     * @returns {Listing} New instance of Listing class
     */
	constructor(dbName = ':memory:') {
		return (async() => {
			this.db = await sqlite.open(dbName)
			// we need this table to store the user accounts
			const sql = 'CREATE TABLE IF NOT EXISTS item (item_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, \
			user_id INTEGER REFERENCES user (user_id) NOT NULL, item_name VARCHAR (50) NOT NULL, \
			item_description VARCHAR (250) NOT NULL, item_img_loc VARCHAR (50) NOT NULL, swap VARCHAR(500) NOT NULL);'
			await this.db.run(sql)
			return this
		})()
	}

	/**
     * Throws an error including input name if variable is empty
     * @param {Object} input - The username of the new user.
     * @param {String} varName - The password of the new user.
     * @throws Will throw an error if variable is empty and provide contextual name
     */
	async errorIfEmpty(input, varName) {
		if(input === null || input === '' || input.length === 0) {
			throw new Error(`${varName} is empty`)
		}
	}

	/**
     * Throws an error including input name if variable is not a number
     * @param {Object} input - The username of the new user.
     * @param {String} varName - The password of the new user.
     * @throws Will throw an error if variable is not a number and provide contextual name
     */
	async errorIfNaN(input, varName) {
		if(isNaN(input)) {
			throw new Error(`invalid ${varName} provided`)
		}
	}

	/** Object definition inspired by answer from Dan Dascalescu at https://stackoverflow.com/a/28763616
	 * Metadata object used to render information in listing.handlebars
	 * @typedef {Object} ListingMetadata
	 * @property {Integer} lister_id The lister's User ID
	 * @property {Integer} id The listing ID
	 * @property {String} itemname The item name
	 * @property {String} itemdescription The item description
	 * @property {String} swaplist Comma separated list of items to swap
	 * @property {String} listerusername Username of listing's creator
	 * @property {String} imgloc Location of Listing's image
	 */

	/**
     * Gets the metadata object literal for a given listing
     * @param {Integer} listingId - The ID of the listing/item
     * @returns {ListingMetadata} ListingMetadata object literal
     * @throws Will throw an error if operation fails and provide descriptive reasoning
     */
	async getMetadata(listingId) {
		try {
			const data = await this.db.get(`SELECT COUNT(item_id) as records FROM item WHERE item_id="${listingId}";`)
			if(data.records === 0) throw new Error(`listing with ID "${listingId}" not found`)
			const record = await this.db.get(`SELECT item_id, user_id, item_name, item_description, item_img_loc,\
			 swap FROM item WHERE item_id="${listingId}";`)

			const lister = record.user_id

			if(record.swap === null) record.swap = 'Nothing provided.'

			const item = { lister_id: lister, id: record.item_id,
				itemname: record.item_name, itemdescription: record.item_description,
				imgloc: record.item_img_loc, swaplist: record.swap }

			const usernameRecord = await this.db.get(`SELECT username FROM user WHERE user_id="${lister}";`)

			item.listerusername = usernameRecord.username

			return item
		} catch(err) {
			throw err
		}
	}

	/**
     * Gets the names of all listings for a given user in an array
     * @param {Integer} User ID
     * @returns {Array} Array of listing names
     * @throws Will throw an error if operation fails and provide descriptive reasoning
     */
	async getListingNamesFromUserID(userID) {
		try {
			await this.errorIfEmpty(userID.toString(), 'user_id')
			await this.errorIfNaN(userID, 'user_id')
			if(parseInt(userID) < 1) throw new Error('invalid user id provided')

			const listingExistsSql = `SELECT COUNT(item_id) as records FROM item WHERE user_id="${userID}";`
			const listingData = await this.db.get(listingExistsSql)
			if(listingData.records === 0) return []

			const sql = `SELECT item_name FROM item WHERE user_id="${userID}";`
			const results = []

			const rows = await this.db.all(sql)

			for(let i = 0; i < rows.length; i++) {
				results.push(rows[i].item_name)
			}

			return results

		} catch(err) {
			throw err
		}
	}

	/**
     * Gets the metadata object literal for all listings in an array
     * @returns {Array} Array of ListingMetadata object literals
     * @throws Will throw an error if operation fails and provide descriptive reasoning
     */
	async getListings() {
		try {
			const data = await this.db.get('SELECT COUNT(item_id) as records FROM item;')
			if(data.records === 0) throw new Error('no listings found')
			const results = []

			const rows = await this.db.all('SELECT item_id, item_name, item_description, item_img_loc FROM item;')

			for(let i = 0; i < rows.length; i++) {

				const item = { id: rows[i].item_id, itemname: rows[i].item_name,
					itemdescription: rows[i].item_description, imgloc: rows[i].item_img_loc,
					listerusername: '', swaplist: '' //not viewable for logged out users
				}

				results.push(item)
			}

			return results

		} catch(err) {
			throw err
		}
	}


	/**
     * Returns a list of items matching a search query
	 * @param {String} Search term to query
     * @returns {Array} Array of item objects
     * @throws Will throw an error if operation fails and provide descriptive reasoning
     */
	async querySearchTerm(searchTerm) {

		const sql = `SELECT item_id, item_name, item_description, item_img_loc, LOWER(item_name) as lowerItemName\
		 FROM item WHERE lowerItemName LIKE '%${searchTerm.toLowerCase()}%';`
		const sqlResult = await this.db.all(sql)

		const matchingItems = []
		for(let i = 0; i < sqlResult.length; i++) {

			const item = {
				id: sqlResult[i].item_id,
				itemname: sqlResult[i].item_name,
				itemdescription: sqlResult[i].item_description,
				imgloc: sqlResult[i].item_img_loc,
			}

			matchingItems.push(item)
		}

		return matchingItems

	}

	/**
     * Creates a listing and returns the listing ID. Does not check if the data is valid
     * @param {Integer} userID - The ID of the listing/item
     * @param {String} itemName - Name of the item being listed
     * @param {String} itemDescription - Description of the item listing
     * @param {String} imgLocation - Relative filepath from webroot to the item image
     * @param {String} swapList - List of items willing to swap
     * @returns {Integer} ID of new listing
     */
	async create(userID, itemName, itemDescription, imgLocation, swapList) {
		try {

			await this.errorIfEmpty(userID.toString(), 'user_id')
			await this.errorIfNaN(userID, 'user_id')
			await this.errorIfEmpty(itemName, 'item_name')
			await this.errorIfEmpty(itemDescription, 'item_description')
			await this.errorIfEmpty(imgLocation, 'img_location')

			const sql = `INSERT INTO item (user_id, item_name, item_description, item_img_loc, swap) \
			VALUES (${userID}, '${itemName}', '${itemDescription}', '${imgLocation}', '${swapList}');`
			const query = await this.db.run(sql)
			return query.lastID
		} catch(err) {
			throw err
		}
	}

}

module.exports = Listing
