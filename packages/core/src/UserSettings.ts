import {
	ENCRYPTION_KEY_ENV_OVERWRITE,
	EXTENSIONS_SUBDIRECTORY,
	USER_FOLDER_ENV_OVERWRITE,
	USER_SETTINGS_FILE_NAME,
	USER_SETTINGS_SUBFOLDER,
	IUserSettings,
} from '.';


import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
const { promisify } = require('util');
const fsAccess = promisify(fs.access);
const fsReadFile = promisify(fs.readFile);
const fsMkdir = promisify(fs.mkdir);
const fsWriteFile = promisify(fs.writeFile);



let settingsCache: IUserSettings | undefined = undefined;


/**
 * Creates the user settings if they do not exist yet
 *
 * @export
 */
export async function prepareUserSettings(): Promise<IUserSettings> {
	const settingsPath = getUserSettingsPath();

	let userSettings = await getUserSettings(settingsPath);
	if (userSettings !== undefined) {
		// Settings already exist, check if they contain the encryptionKey
		if (userSettings.encryptionKey !== undefined) {
			// Key already exists so return
			return userSettings;
		}
	} else {
		userSettings = {};
	}

	// Settings and/or key do not exist. So generate a new encryption key
	userSettings.encryptionKey = randomBytes(24).toString('base64');

	console.log(`UserSettings got generated and saved to: ${settingsPath}`);

	return writeUserSettings(userSettings, settingsPath);
}


/**
 * Returns the encryption key which is used to encrypt
 * the credentials.
 *
 * @export
 * @returns
 */
export async function getEncryptionKey() {
	if (process.env[ENCRYPTION_KEY_ENV_OVERWRITE] !== undefined) {
		return process.env[ENCRYPTION_KEY_ENV_OVERWRITE];
	}

	const userSettings = await getUserSettings();

	if (userSettings === undefined) {
		return undefined;
	}

	if (userSettings.encryptionKey === undefined) {
		return undefined;
	}

	return userSettings.encryptionKey;
}


/**
 * Adds/Overwrite the given settings in the currently
 * saved user settings
 *
 * @export
 * @param {IUserSettings} addSettings  The settings to add/overwrite
 * @param {string} [settingsPath] Optional settings file path
 * @returns {Promise<IUserSettings>}
 */
export async function addToUserSettings(addSettings: IUserSettings, settingsPath?: string): Promise<IUserSettings> {
	if (settingsPath === undefined) {
		settingsPath = getUserSettingsPath();
	}

	let userSettings = await getUserSettings(settingsPath);

	if (userSettings === undefined) {
		userSettings = {};
	}

	// Add the settings
	Object.assign(userSettings, addSettings);

	return writeUserSettings(userSettings, settingsPath);
}


/**
 * Writes a user settings file
 *
 * @export
 * @param {IUserSettings} userSettings The settings to write
 * @param {string} [settingsPath] Optional settings file path
 * @returns {Promise<IUserSettings>}
 */
export async function writeUserSettings(userSettings: IUserSettings, settingsPath?: string): Promise<IUserSettings> {
	if (settingsPath === undefined) {
		settingsPath = getUserSettingsPath();
	}

	if (userSettings === undefined) {
		userSettings = {};
	}

	// Check if parent folder exists if not create it.
	try {
		await fsAccess(path.dirname(settingsPath));
	} catch (error) {
		// Parent folder does not exist so create
		await fsMkdir(path.dirname(settingsPath));
	}

	await fsWriteFile(settingsPath, JSON.stringify(userSettings, null, '\t'));
	settingsCache = JSON.parse(JSON.stringify(userSettings));

	return userSettings;
}


/**
 * Returns the content of the user settings
 *
 * @export
 * @returns {UserSettings}
 */
export async function getUserSettings(settingsPath?: string, ignoreCache?: boolean): Promise<IUserSettings | undefined> {
	if (settingsCache !== undefined && ignoreCache !== true) {
		return settingsCache;
	}

	if (settingsPath === undefined) {
		settingsPath = getUserSettingsPath();
	}

	try {
		await fsAccess(settingsPath);
	} catch (error) {
		// The file does not exist
		return undefined;
	}

	const settingsFile = await fsReadFile(settingsPath, 'utf8');

	try {
		settingsCache = JSON.parse(settingsFile);
	} catch (error) {
		throw new Error(`Error parsing n8n-config file "${settingsPath}". It does not seem to be valid JSON.`);
	}

	return settingsCache as IUserSettings;
}


/**
 * Returns the path to the user settings
 *
 * @export
 * @returns {string}
 */
export function getUserSettingsPath(): string {
	const n8nFolder = getUserN8nFolderPath();

	return path.join(n8nFolder, USER_SETTINGS_FILE_NAME);
}



/**
 * Retruns the path to the n8n folder in which all n8n
 * related data gets saved
 *
 * @export
 * @returns {string}
 */
export function getUserN8nFolderPath(): string {
	let userFolder;
	if (process.env[USER_FOLDER_ENV_OVERWRITE] !== undefined) {
		userFolder = process.env[USER_FOLDER_ENV_OVERWRITE] as string;
	} else {
		userFolder = getUserHome();
	}

	return path.join(userFolder, USER_SETTINGS_SUBFOLDER);
}


/**
 * Returns the path to the n8n user folder with the custom
 * extensions like nodes and credentials
 *
 * @export
 * @returns {string}
 */
export function getUserN8nFolderCustomExtensionPath(): string {
	return path.join(getUserN8nFolderPath(), EXTENSIONS_SUBDIRECTORY);
}


/**
 * Returns the home folder path of the user if
 * none can be found it falls back to the current
 * working directory
 *
 * @export
 * @returns {string}
 */
export function getUserHome(): string {
	let variableName = 'HOME';
	if (process.platform === 'win32') {
		variableName = 'USERPROFILE';
	}

	if (process.env[variableName] === undefined) {
		// If for some reason the variable does not exist
		// fall back to current folder
		return process.cwd();
	}

	return process.env[variableName] as string;
}
