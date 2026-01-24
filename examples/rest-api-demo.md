---
workflow:
  id: rest-api-demo
  name: 'REST API Integration Demo'
  version: '1.0.0'
  description: 'Demonstrates calling custom REST APIs with different auth methods'

tools:
  jsonplaceholder:
    sdk: 'http'
    options:
      base_url: 'https://jsonplaceholder.typicode.com'

  github_api:
    sdk: 'http'
    options:
      base_url: 'https://api.github.com'
    auth:
      type: 'bearer'
      token: '${GITHUB_TOKEN}' # Optional: Only needed for authenticated endpoints

inputs:
  user_id:
    type: number
    required: false
    default: 1

steps:
  - id: fetch_user
    name: 'Fetch User Data'
    action: jsonplaceholder.get
    inputs:
      path: '/users/{{ inputs.user_id }}'
    output_variable: user

  - id: fetch_posts
    name: 'Fetch User Posts'
    action: jsonplaceholder.get
    inputs:
      path: '/posts'
      query:
        userId: '{{ inputs.user_id }}'
    output_variable: posts

  - id: create_post
    name: 'Create New Post'
    action: jsonplaceholder.post
    inputs:
      path: '/posts'
      body:
        title: 'Test Post from marktoflow'
        body: 'This is a test post created by the marktoflow automation framework'
        userId: '{{ inputs.user_id }}'
    output_variable: new_post

  - id: update_post
    name: 'Update Post'
    action: jsonplaceholder.put
    inputs:
      path: '/posts/{{ new_post.data.id }}'
      body:
        title: 'Updated Title'
        body: 'Updated body content'
        userId: '{{ inputs.user_id }}'
    output_variable: updated_post

  - id: display_results
    name: 'Display Results'
    action: console.log
    inputs:
      message: |
        ===== REST API Demo Results =====

        User: {{ user.data.name }} ({{ user.data.email }})
        Posts Count: {{ posts.data | length }}

        Created Post ID: {{ new_post.data.id }}
        Created Post Title: {{ new_post.data.title }}

        Updated Post Status: {{ updated_post.status }}
        ===================================
---

# REST API Integration Demo

This workflow demonstrates marktoflow's REST API capabilities using JSONPlaceholder (a free fake REST API).

## Features Demonstrated

1. **GET Requests** - Fetching user data and posts
2. **Query Parameters** - Filtering posts by userId
3. **POST Requests** - Creating new resources
4. **PUT Requests** - Updating existing resources
5. **Variable Interpolation** - Using data from previous steps
6. **Response Handling** - Accessing status, data, and headers

## Running the Workflow

```bash
# Basic usage
marktoflow run examples/rest-api-demo.md

# With custom user ID
marktoflow run examples/rest-api-demo.md -i user_id=5

# Debug mode
marktoflow debug examples/rest-api-demo.md

# Dry run (see what would happen)
marktoflow run examples/rest-api-demo.md --dry-run
```

## Using with Real APIs

To use this with your own API, update the `tools` section:

```yaml
tools:
  my_api:
    sdk: 'http'
    options:
      base_url: 'https://api.yourservice.com'
    auth:
      type: 'bearer'
      token: '${YOUR_API_TOKEN}'
```

## Supported Authentication

- **Bearer Token** - Most common for modern APIs
- **Basic Auth** - Username/password
- **API Key** - Custom header-based authentication
- **No Auth** - For public APIs

See [REST API Guide](../docs/REST-API-GUIDE.md) for complete documentation.
