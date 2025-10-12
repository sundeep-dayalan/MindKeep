/**
 * Crypto utilities for MindKeep
 * Handles encryption and decryption of note content using SubtleCrypto API
 * All operations happen client-side to ensure 100% privacy
 * 
 * CRITICAL: This service only encrypts/decrypts the content field.
 * It does NOT handle embeddings - that is done by ai-service.ts
 * It does NOT handle storage - that is done by db-service.ts
 * 
 * Pipeline position:
 * - Encryption: Step 3 (after embedding generation, before storage)
 * - Decryption: Step 3 of retrieval (after database fetch, before display)
 */

// Constants
const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

// Storage key for the encryption key
const ENCRYPTION_KEY_STORAGE_KEY = "mindkeep_encryption_key"

/**
 * Derives a cryptographic key from a password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Import the password as a key
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )

  // Derive the encryption key
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

/**
 * Generates a random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

/**
 * Generates a random IV (Initialization Vector)
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

/**
 * Gets or creates the master encryption key
 * The key is stored in Chrome's local storage and derived from a random password
 */
async function getMasterKey(): Promise<CryptoKey> {
  try {
    // Try to get existing key from storage
    const stored = await new Promise<any>((resolve) => {
      chrome.storage.local.get(ENCRYPTION_KEY_STORAGE_KEY, resolve)
    })

    if (stored[ENCRYPTION_KEY_STORAGE_KEY]) {
      const keyData = stored[ENCRYPTION_KEY_STORAGE_KEY]

      // Import the stored key
      return await crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: ALGORITHM, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
      )
    }

    // Generate a new key if none exists
    const salt = generateSalt()
    const randomPassword = crypto.getRandomValues(new Uint8Array(32))
    const passwordString = Array.from(randomPassword)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const key = await deriveKey(passwordString, salt)

    // Export and store the key
    const exportedKey = await crypto.subtle.exportKey("jwk", key)
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          [ENCRYPTION_KEY_STORAGE_KEY]: exportedKey
        },
        resolve
      )
    })

    return key
  } catch (error) {
    console.error("Error getting master key:", error)
    throw new Error("Failed to initialize encryption key")
  }
}

/**
 * Converts an ArrayBuffer to a base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Converts a base64 string to an ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Encrypts a plaintext string
 * 
 * IMPORTANT: This function should be called AFTER embedding generation
 * in the save pipeline. Only the content field is encrypted, not the
 * title, category, or embedding vector.
 * 
 * @param text - The plaintext content to encrypt
 * @returns A base64-encoded string containing the IV and encrypted data
 */
export async function encrypt(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)

    const key = await getMasterKey()
    const iv = generateIV()

    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource
      },
      key,
      data
    )

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encryptedData), iv.length)

    // Convert to base64 for storage
    return arrayBufferToBase64(combined.buffer)
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt data")
  }
}

/**
 * Decrypts an encrypted string back to plaintext
 * 
 * IMPORTANT: This function should be called AFTER database retrieval
 * in the search pipeline. It only decrypts the content field.
 * 
 * @param encryptedText - The base64-encoded encrypted string
 * @returns The decrypted plaintext content
 */
export async function decrypt(encryptedText: string): Promise<string> {
  try {
    // Convert from base64
    const combined = new Uint8Array(base64ToArrayBuffer(encryptedText))

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH)
    const encryptedData = combined.slice(IV_LENGTH)

    const key = await getMasterKey()

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource
      },
      key,
      encryptedData
    )

    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decryptedData)
  } catch (error) {
    console.error("Decryption error:", error)
    throw new Error("Failed to decrypt data")
  }
}

/**
 * Tests the encryption and decryption functionality
 * Useful for debugging
 */
export async function testCrypto(): Promise<boolean> {
  try {
    const testString = "Hello, MindKeep! 🧠"
    const encrypted = await encrypt(testString)
    const decrypted = await decrypt(encrypted)

    const success = testString === decrypted
    console.log("Crypto test:", success ? "✅ PASSED" : "❌ FAILED")
    console.log("Original:", testString)
    console.log("Encrypted:", encrypted.substring(0, 50) + "...")
    console.log("Decrypted:", decrypted)

    return success
  } catch (error) {
    console.error("Crypto test failed:", error)
    return false
  }
}

/**
 * Clears the stored encryption key (use with caution!)
 * This will make all encrypted data unrecoverable
 */
export async function clearEncryptionKey(): Promise<void> {
  await chrome.storage.local.remove(ENCRYPTION_KEY_STORAGE_KEY)
  console.warn(
    "Encryption key cleared. All encrypted data is now unrecoverable."
  )
}
