/**
 * Base API Service
 *
 * Consolidates common patterns from:
 * - ProjectService
 * - UserService
 * - APIKeyService
 * - AdminService
 *
 * Features:
 * - Centralized authentication header management
 * - Consistent error handling
 * - Common API patterns (CRUD operations)
 * - Query parameter building
 * - Type-safe responses
 */

import { privyAuthManager } from '@/auth/PrivyAuthManager'
import { apiFetch } from '@/utils/api'

export interface APIRequestOptions {
  /**
   * Request timeout in milliseconds
   */
  timeout?: number

  /**
   * Additional headers
   */
  headers?: HeadersInit

  /**
   * Whether to include authentication headers
   */
  authenticate?: boolean
}

export interface ListOptions {
  page?: number
  limit?: number
  [key: string]: any
}

/**
 * Base class for API services with common functionality
 *
 * Provides:
 * - Authentication header management
 * - Standard CRUD operations
 * - Error handling
 * - Query parameter building
 *
 * @example
 * ```typescript
 * class ProjectService extends BaseAPIService {
 *   constructor() {
 *     super('/api/projects')
 *   }
 *
 *   async getProjects(filters?: ProjectFilters) {
 *     return this.list<Project>(filters)
 *   }
 *
 *   async createProject(data: CreateProjectData) {
 *     return this.create<Project>(data)
 *   }
 * }
 * ```
 */
export class BaseAPIService {
  protected baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Get authentication headers with Bearer token
   *
   * @throws {Error} If not authenticated
   */
  protected getAuthHeaders(): HeadersInit {
    const token = privyAuthManager.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  /**
   * Build headers for request
   */
  protected buildHeaders(
    options: APIRequestOptions = {}
  ): HeadersInit {
    const { authenticate = true, headers = {} } = options

    const baseHeaders: HeadersInit = authenticate
      ? this.getAuthHeaders()
      : { 'Content-Type': 'application/json' }

    return {
      ...baseHeaders,
      ...headers
    }
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(
    path: string,
    params?: Record<string, any>
  ): string {
    const url = path.startsWith('/') ? path : `${this.baseUrl}/${path}`

    if (!params || Object.keys(params).length === 0) {
      return url
    }

    const searchParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })

    const queryString = searchParams.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  /**
   * Handle API response
   */
  protected async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `Request failed with status ${response.status}`)
    }

    // Check if response has content
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }

    // Return empty object for no content
    return {} as T
  }

  /**
   * Generic GET request
   */
  protected async get<T>(
    path: string,
    params?: Record<string, any>,
    options: APIRequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(path, params)
    const response = await apiFetch(url, {
      headers: this.buildHeaders(options),
      timeoutMs: options.timeout || 10000
    })

    return this.handleResponse<T>(response)
  }

  /**
   * Generic POST request
   */
  protected async post<T>(
    path: string,
    body?: any,
    options: APIRequestOptions = {}
  ): Promise<T> {
    const url = path.startsWith('/') ? path : `${this.baseUrl}/${path}`
    const response = await apiFetch(url, {
      method: 'POST',
      headers: this.buildHeaders(options),
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: options.timeout || 10000
    })

    return this.handleResponse<T>(response)
  }

  /**
   * Generic PUT request
   */
  protected async put<T>(
    path: string,
    body?: any,
    options: APIRequestOptions = {}
  ): Promise<T> {
    const url = path.startsWith('/') ? path : `${this.baseUrl}/${path}`
    const response = await apiFetch(url, {
      method: 'PUT',
      headers: this.buildHeaders(options),
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: options.timeout || 10000
    })

    return this.handleResponse<T>(response)
  }

  /**
   * Generic DELETE request
   */
  protected async delete<T = void>(
    path: string,
    body?: any,
    options: APIRequestOptions = {}
  ): Promise<T> {
    const url = path.startsWith('/') ? path : `${this.baseUrl}/${path}`
    const response = await apiFetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(options),
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: options.timeout || 10000
    })

    return this.handleResponse<T>(response)
  }

  /**
   * Standard list operation
   */
  protected async list<T>(
    filters?: ListOptions,
    options: APIRequestOptions = {}
  ): Promise<T[]> {
    return this.get<T[]>(this.baseUrl, filters, options)
  }

  /**
   * Standard get by ID operation
   */
  protected async getById<T>(
    id: string,
    options: APIRequestOptions = {}
  ): Promise<T> {
    return this.get<T>(`${this.baseUrl}/${id}`, undefined, options)
  }

  /**
   * Standard create operation
   */
  protected async create<T>(
    data: any,
    options: APIRequestOptions = {}
  ): Promise<T> {
    return this.post<T>(this.baseUrl, data, options)
  }

  /**
   * Standard update operation
   */
  protected async update<T>(
    id: string,
    data: any,
    options: APIRequestOptions = {}
  ): Promise<T> {
    return this.put<T>(`${this.baseUrl}/${id}`, data, options)
  }

  /**
   * Standard delete operation
   */
  protected async deleteById(
    id: string,
    options: APIRequestOptions = {}
  ): Promise<void> {
    return this.delete<void>(`${this.baseUrl}/${id}`, undefined, options)
  }
}
