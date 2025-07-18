/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      mount(component: React.ReactElement): Chainable<any>
    }
  }
}

export {}; 