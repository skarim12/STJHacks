# PowerPoint AI Assistant Add-in

An intelligent Microsoft PowerPoint add-in that transforms rough ideas into polished, structured presentations using Claude AI.

## Features

- **Idea-to-Slides Generation**: Describe your presentation idea and let AI create a complete slide deck
- **Smart Content Structuring**: Automatic organization of content into appropriate slide types
- **Research Assistant**: Built-in research capabilities for adding facts and statistics
- **Color Theme Management**: AI-powered color scheme generation and application
- **Speaker Notes**: Automatic generation of comprehensive speaker notes
- **Multiple Slide Types**: Title, content, comparison, two-column, section headers, and more

## Prerequisites

- **Node.js**: Version 16.x or higher
- **npm**: Version 8.x or higher
- **Microsoft PowerPoint**: Desktop version (Microsoft 365)
- **Claude API Key**: Get from [console.anthropic.com](https://console.anthropic.com)

## Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to project directory
cd powerpoint-ai-assistant

# Install dependencies
npm install
```

### 2. Generate SSL Certificates (Required for Office Add-ins)

```bash
# Install Office dev certs tool
npm install -g office-addin-dev-certs

# Generate certificates
npx office-addin-dev-certs install
```

### 3. Configure the Add-in

Update the `manifest.xml` file with your details:

```xml
<Id>YOUR-UNIQUE-GUID-HERE</Id>
<ProviderName>Your Name/Company</ProviderName>
<DefaultSettings>
  <SourceLocation DefaultValue="https://localhost:3000/taskpane.html"/>
</DefaultSettings>
```

Generate a new GUID at [guidgenerator.com](https://www.guidgenerator.com/)

### 4. Start Development Server

```bash
# Start the webpack dev server
npm run dev
```

This will start a local HTTPS server at `https://localhost:3000`

### 5. Sideload the Add-in

#### Windows:
1. Open PowerPoint
2. Go to **Insert** > **Get Add-ins** > **My Add-ins**
3. Click **Upload My Add-in**
4. Browse to your `manifest.xml` file
5. Click **Upload**

#### Mac:
1. Copy `manifest.xml` to `/Users/{username}/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef`
2. Restart PowerPoint
3. Go to **Insert** > **Add-ins** > **My Add-ins**

### 6. Configure API Key

1. Open the add-in task pane in PowerPoint
2. Enter your Claude API key from [console.anthropic.com](https://console.anthropic.com)
3. Click "Configure"

## Usage

### Creating a Presentation

1. Click the **Create** tab
2. Describe your presentation idea in detail
3. Set your preferences:
   - **Tone**: Professional, Casual, Academic, or Creative
   - **Audience**: Who will be viewing the presentation
   - **Slide Count**: How many slides you want
   - **Industry**: Optional industry context
   - **Research**: Enable to include statistics and facts
4. Click **Generate Presentation**
5. Wait while AI creates your slides
6. Review and edit the generated slides

### Using the Research Assistant

1. Click the **Research** tab
2. Enter a topic to research
3. Click **Research**
4. Review facts, statistics, and sources
5. Use findings to enhance your presentation

### Customizing Colors

1. Click the **Theme** tab
2. Select or customize colors
3. Click **Apply Theme** to update all slides

## Project Structure

```
powerpoint-ai-assistant/
├── src/
│   ├── taskpane/
│   │   ├── components/       # React components
│   │   ├── services/         # AI, PowerPoint, Research services
│   │   ├── store/           # Zustand state management
│   │   ├── types/           # TypeScript type definitions
│   │   ├── App.tsx          # Main app component
│   │   └── index.tsx        # Entry point
│   └── commands/            # Office ribbon commands
├── assets/                  # Icons and images
├── manifest.xml            # Add-in manifest
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Validate manifest
npm run validate
```

### Adding New Features

1. Create new components in `src/taskpane/components/`
2. Add services in `src/taskpane/services/`
3. Update types in `src/types/index.ts`
4. Update store in `src/store/useStore.ts`

## API Integration

The add-in uses the Anthropic Claude API for AI features:

- **Model**: claude-sonnet-4-20250514
- **Endpoint**: https://api.anthropic.com/v1/messages
- **Authentication**: API key in headers

### API Key Security

- API keys are stored in browser localStorage
- Never commit API keys to version control
- For production, implement a backend proxy to secure keys

## Deployment

### Building for Production

```bash
npm run build
```

### Hosting the Add-in

1. Build the project
2. Upload `dist/` folder to your web server (must support HTTPS)
3. Update `manifest.xml` with your production URL
4. Publish to Microsoft AppSource (optional)

### Publishing to AppSource

1. Complete the [Partner Center registration](https://partner.microsoft.com/)
2. Prepare app package with manifest and assets
3. Submit for validation
4. Wait for approval (typically 1-2 weeks)

## Troubleshooting

### Add-in doesn't load
- Ensure dev server is running on `https://localhost:3000`
- Check browser console for errors
- Verify SSL certificates are installed
- Clear Office cache: Close PowerPoint, delete `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\`

### API errors
- Verify API key is correct
- Check API quota/rate limits
- Ensure internet connection is stable

### Slides not creating
- Check PowerPoint.run() context errors
- Verify Office.js is loaded
- Check browser console for JavaScript errors

## Technologies Used

- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **Fluent UI React** - Microsoft's design system
- **Office.js** - PowerPoint integration
- **Zustand** - State management
- **Axios** - HTTP client
- **Webpack** - Module bundler
- **Claude API** - AI capabilities

## Best Practices

1. **Be Specific**: Provide detailed descriptions for better AI outputs
2. **Review Content**: Always review and edit AI-generated content
3. **Save Frequently**: Save your PowerPoint file regularly
4. **Test Themes**: Preview color themes before applying
5. **Use Research**: Enable research for data-driven presentations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [your-repo-url]
- Documentation: [your-docs-url]
- Email: [your-email]

## Acknowledgments

- Built with [Anthropic Claude API](https://www.anthropic.com)
- Uses [Microsoft Fluent UI](https://developer.microsoft.com/en-us/fluentui)
- Powered by [Office.js](https://docs.microsoft.com/en-us/office/dev/add-ins/)

---

**Note**: This is a development version. For production use, implement proper security measures, error handling, and user authentication.
