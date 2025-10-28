

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

const ENCRYPTION_KEY_STORAGE_KEY = "mindkeep_encryption_key"

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  )
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

async function getMasterKey(): Promise<CryptoKey> {
  try {
    console.log(" Getting master key...")

    const stored = await new Promise<any>((resolve) => {
      chrome.storage.local.get(ENCRYPTION_KEY_STORAGE_KEY, resolve)
    })

    if (stored[ENCRYPTION_KEY_STORAGE_KEY]) {
      console.log(" Found existing key in storage, importing...")
      const keyData = stored[ENCRYPTION_KEY_STORAGE_KEY]

      const importedKey = await crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: ALGORITHM, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
      )
      console.log(" Key imported successfully:", importedKey.type)
      return importedKey
    }

    console.log(" No existing key found, generating new one...")

    const salt = generateSalt()
    const randomPassword = crypto.getRandomValues(new Uint8Array(32))
    const passwordString = Array.from(randomPassword)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    console.log(" Deriving new key from random password...")
    const key = await deriveKey(passwordString, salt)
    console.log(" Key derived successfully:", key.type)

    console.log(" Exporting and storing key...")
    const exportedKey = await crypto.subtle.exportKey("jwk", key)
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          [ENCRYPTION_KEY_STORAGE_KEY]: exportedKey
        },
        resolve
      )
    })
    console.log(" Key stored successfully")

    return key
  } catch (error) {
    console.error(" Error getting master key:", error)
    throw new Error(
      "Failed to initialize encryption key: " +
        (error instanceof Error ? error.message : String(error))
    )
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function encrypt(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)

    const key = await getMasterKey()

    if (!key) {
      throw new Error("Failed to get encryption key")
    }

    console.log(" Key obtained:", key.type, key.algorithm)
    const iv = generateIV()

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource
      },
      key,
      data
    )

    const combined = new Uint8Array(iv.length + encryptedData.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encryptedData), iv.length)

    return arrayBufferToBase64(combined.buffer)
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt data")
  }
}

export async function decrypt(encryptedText: string): Promise<string> {
  try {

    const combined = new Uint8Array(base64ToArrayBuffer(encryptedText))

    const iv = combined.slice(0, IV_LENGTH)
    const encryptedData = combined.slice(IV_LENGTH)

    const key = await getMasterKey()

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource
      },
      key,
      encryptedData
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedData)
  } catch (error) {
    console.error("Decryption error:", error)
    throw new Error("Failed to decrypt data")
  }
}

export async function testCrypto(): Promise<boolean> {
  try {
    const testString = "Hello, MindKeep! "
    const encrypted = await encrypt(testString)
    const decrypted = await decrypt(encrypted)

    const success = testString === decrypted
    console.log("Crypto test:", success ? " PASSED" : " FAILED")
    console.log("Original:", testString)
    console.log("Encrypted:", encrypted.substring(0, 50) + "...")
    console.log("Decrypted:", decrypted)

    return success
  } catch (error) {
    console.error("Crypto test failed:", error)
    return false
  }
}

export async function clearEncryptionKey(): Promise<void> {
  await chrome.storage.local.remove(ENCRYPTION_KEY_STORAGE_KEY)
  console.warn(
    "Encryption key cleared. All encrypted data is now unrecoverable."
  )
}
