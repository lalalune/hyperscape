# Contributing Guide

Thank you for considering contributing to this project! Below are some guidelines to help you contribute effectively.

## Getting Started

### 1. Fork the Repository

Click the `Fork` button at the top-right corner of this page to create a copy of this repository under your GitHub account.

### 2. Clone Your Fork

Clone the repository to your local machine using the following command in the terminal:

```bash
git clone https://github.com/hyperfy-xyz/hyperfy.git
```

### 3. Create a Branch

Create a new branch to work on your contribution:

```bash
git checkout -b branch-name
```

Choose a descriptive branch name that briefly explains the changes you will make, such as feature/add-new-feature or fix/resolve-issue-x.

### 4. Make Your Changes

Make the necessary changes in your local branch. Be sure to follow the project’s style and structure conventions.

### 5. Ensure Everything Works

Before submitting your changes, ensure everything works correctly and nothing is broken. Run the project’s tests, if any:

```bash
npm run test
```

### 6. Commit and Push Your Changes

Stage and commit your changes:

```bash
git add .
git commit -m "Clear and concise description of the changes"
```

Then, push your changes to your forked repository:

```bash
git push origin branch-name
```

### 7. Create a Pull Request

Once your changes are in your fork, go to the main page of this repository (the original one) and click the New Pull Request button. Select the branch you created and describe the changes you made.

## Code Conventions

Please follow these guidelines for component development:

- **Component Architecture**: Follow Hyperfy's component patterns
- **State Management**: Use appropriate state handling for components
- **Event Handling**: Follow Hyperfy's event system conventions
- **Performance**: Optimize component updates and interactions
- **Reusability**: Design components to be reusable across different worlds
- **Documentation**: Provide clear usage examples and props documentation

### Example Component

```javascript
/**
 * Interactive component for Hyperfy worlds
 * @param {Object} props - Component properties
 * @param {Vector3} props.position - Initial position
 * @param {Function} props.onInteract - Interaction callback
 */
export default function InteractiveComponent(props) {
  const { position, onInteract } = props
  
  useEffect(() => {
    // Setup component
    return () => {
      // Cleanup
    }
  }, [])

  return (
    <component
      position={position}
      onClick={onInteract}
    >
      {/* Component content */}
    </component>
  )
}
```

## Testing Guidelines

- Test component behavior in different world contexts
- Verify interactions with other components
- Test performance with multiple instances
- Validate proper cleanup on unmount

## Linting and Formatting

- **Linting**: We use ESLint for linting. Ensure your code passes all linting checks before submitting a pull request.
- **Formatting**: We use Prettier for code formatting. Run Prettier before committing to ensure consistent formatting.

## Reporting Bugs

If you find a bug, please open an [issue](https://github.com/hyperfy-xyz/hyperfy/issues) and provide as much information as possible:

- Problem Description: What you expected to happen vs. what actually happened.
- Steps to Reproduce: Detail the specific steps you took to find the bug.
- Development Environment: Include details like operating system, software versions, etc.

## Suggesting New Features

If you have ideas for new features, open an [issue](https://github.com/hyperfy-xyz/hyperfy/issues) describing your proposal. We’d love to hear your ideas and discuss how we could implement them.

## Acknowledgements

Thank you for taking the time to contribute to this project. Every contribution is greatly appreciated and helps improve the project for everyone.