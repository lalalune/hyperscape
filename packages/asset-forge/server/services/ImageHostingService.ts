/**
 * Image Hosting Service
 * Provides fallback options for hosting images publicly when local server is not accessible
 */

interface UploadOptions {
  // Future options for image upload configuration
  maxSize?: number;
  format?: string;
}

interface ImgurUploadResponse {
  data: {
    link: string;
    id: string;
    deletehash: string;
  };
  success: boolean;
  status: number;
}

interface ImgurUploadRequest {
  image: string;
  type: "base64" | "url";
}

export class ImageHostingService {
  private readonly imgurClientId: string | null;

  constructor() {
    this.imgurClientId = process.env.IMGUR_CLIENT_ID || null;
  }

  /**
   * Upload image to a public hosting service
   * Falls back to data URI if no hosting service is available
   */
  async uploadImage(
    imageDataOrPath: string,
    options: UploadOptions = {},
  ): Promise<string> {
    try {
      // If we have Imgur configured, use it
      if (this.imgurClientId) {
        return await this.uploadToImgur(imageDataOrPath);
      }

      // If it's already a URL, return it
      if (
        typeof imageDataOrPath === "string" &&
        imageDataOrPath.startsWith("http")
      ) {
        return imageDataOrPath;
      }

      // If it's a data URI and small enough, return it
      if (
        typeof imageDataOrPath === "string" &&
        imageDataOrPath.startsWith("data:")
      ) {
        if (imageDataOrPath.length < 5000000) {
          // Less than 5MB
          console.log(
            "📸 Using data URI directly (no public hosting configured)",
          );
          return imageDataOrPath;
        } else {
          throw new Error(
            "Image too large for data URI and no public hosting configured",
          );
        }
      }

      // Otherwise, we need a public hosting service
      throw new Error(
        "No public image hosting service configured. Set IMGUR_CLIENT_ID in .env or use ngrok.",
      );
    } catch (error) {
      console.error("Failed to upload image:", error);
      throw error;
    }
  }

  /**
   * Upload to Imgur (free image hosting)
   */
  async uploadToImgur(imageData: string): Promise<string> {
    try {
      let base64Data = imageData;

      // Convert to base64 if needed
      if (imageData.startsWith("data:")) {
        base64Data = imageData.split(",")[1]!;
      }

      const requestBody: ImgurUploadRequest = {
        image: base64Data,
        type: "base64",
      };

      const response = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: {
          Authorization: `Client-ID ${this.imgurClientId}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Imgur upload failed: ${response.statusText}`);
      }

      const data = (await response.json()) as ImgurUploadResponse;
      console.log("✅ Image uploaded to Imgur:", data.data.link);
      return data.data.link;
    } catch (error) {
      console.error("Imgur upload error:", error);
      throw error;
    }
  }

  /**
   * Get instructions for setting up public image hosting
   */
  static getSetupInstructions(): string {
    return `
📸 Image Hosting Setup Instructions:

Option 1: Use ngrok (Recommended for development)
  1. Install: npm install -g ngrok
  2. Run: ngrok http 8080
  3. Set IMAGE_SERVER_URL to the ngrok URL in .env

Option 2: Use Imgur (Free, no ngrok needed)
  1. Go to https://api.imgur.com/oauth2/addclient
  2. Register an application (anonymous usage)
  3. Get your Client ID
  4. Add to .env: IMGUR_CLIENT_ID=your_client_id

Option 3: Use data URIs (automatic fallback)
  - Works for images under 5MB
  - No setup required
  - May not work with all APIs

For production, use AWS S3, Cloudinary, or similar.
`;
  }
}
