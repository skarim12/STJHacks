# Quick Start Guide - PowerPoint AI Add-in

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Generate SSL Certificates

```bash
npx office-addin-dev-certs install
```

### Step 3: Update Manifest

1. Open `manifest.xml`
2. Replace `YOUR-UNIQUE-GUID-HERE` with a new GUID from https://www.guidgenerator.com/
3. (Optional) Update `ProviderName` with your name

### Step 4: Start Development Server

```bash
npm run dev
```

The server will start at `https://localhost:3000`

### Step 5: Sideload in PowerPoint

**Windows:**
1. Open PowerPoint
2. Insert → Get Add-ins → My Add-ins
3. Click "Upload My Add-in"
4. Select `manifest.xml`
5. Click Upload

**Mac:**
1. Copy `manifest.xml` to:  
   `/Users/{username}/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef`
2. Restart PowerPoint
3. Insert → Add-ins → My Add-ins

### Step 6: Configure API Key

1. Click the add-in button in PowerPoint ribbon
2. Enter your Claude API key from https://console.anthropic.com
3. Click "Configure"

### Step 7: Create Your First Presentation!

1. In the "Create" tab, describe your presentation idea
2. Set preferences (tone, audience, slide count)
3. Click "Generate Presentation"
4. Watch as AI creates your slides!

## 📁 Project Structure

```
powerpoint-ai-addin/
├── src/
│   ├── services/          # AI, PowerPoint, Research services
│   │   ├── AIService.ts              # Claude API integration
│   │   ├── PowerPointService.ts      # Office.js PowerPoint control
│   │   └── ResearchService.ts        # Research capabilities
│   ├── taskpane/          # React UI components
│   │   ├── components/
│   │   │   ├── IdeaInputPanel.tsx    # Main creation interface
│   │   │   ├── SlidePreview.tsx      # Preview generated slides
│   │   │   └── stubs.tsx             # Research & Theme panels
│   │   ├── App.tsx                   # Main app component
│   │   └── index.tsx                 # Entry point
│   ├── store/             # State management
│   │   └── useStore.ts               # Zustand store
│   └── types/             # TypeScript definitions
│       └── index.ts                  # All type definitions
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── webpack.config.js      # Build configuration
├── manifest.xml          # Office Add-in manifest
└── README.md             # Full documentation
```

## 🔑 Key Files to Understand

### 1. `src/services/AIService.ts`
- Handles all Claude API communication
- Generates presentation outlines
- Enhances content
- Creates speaker notes
- Generates color schemes

**Key Methods:**
- `generatePresentationOutline()` - Main generation function
- `enhanceSlideContent()` - Improve existing content
- `generateSpeakerNotes()` - Create notes
- `generateColorScheme()` - Color theme generation

### 2. `src/services/PowerPointService.ts`
- Controls PowerPoint using Office.js
- Creates and formats slides
- Applies themes
- Manages layouts

**Key Methods:**
- `createSlideFromStructure()` - Create a slide
- `applyColorTheme()` - Apply colors
- `getAllSlides()` - Get existing slides
- `updateSlideContent()` - Edit slides

### 3. `src/store/useStore.ts`
- Zustand state management
- Manages application state
- Coordinates services

**Key State:**
- `currentOutline` - Generated presentation structure
- `userPreferences` - User settings
- `isGenerating` - Loading state
- `generationProgress` - Progress tracking

### 4. `src/taskpane/components/IdeaInputPanel.tsx`
- Main UI for creating presentations
- Preference settings
- Generates and displays results

## 🛠 Development Workflow

### Making Changes

1. **Edit TypeScript/React files** in `src/`
2. **Webpack hot reload** will update automatically
3. **Refresh add-in** in PowerPoint to see changes

### Adding New Features

**Example: Add a new slide type**

1. **Update types** (`src/types/index.ts`):
```typescript
export type SlideType = 'title' | 'content' | 'chart' | 'newType';
```

2. **Update PowerPointService** (`src/services/PowerPointService.ts`):
```typescript
private async createNewTypeSlide(
  shapes: PowerPoint.ShapeCollection,
  structure: SlideStructure
): Promise<void> {
  // Implementation
}
```

3. **Update AI prompts** (`src/services/AIService.ts`):
```typescript
// Add 'newType' to prompt instructions
```

## 🎨 Customization

### Change Color Scheme
Edit `getDefaultColorScheme()` in `AIService.ts`

### Modify Slide Layouts
Edit layout functions in `PowerPointService.ts`

### Adjust AI Behavior
Modify prompts in `AIService.ts` methods

## 🐛 Common Issues

### Issue: "Office.js not loaded"
**Solution:** Ensure `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` is accessible

### Issue: SSL certificate errors
**Solution:** Run `npx office-addin-dev-certs install` again

### Issue: Add-in not appearing
**Solution:**
1. Close PowerPoint completely
2. Delete Office cache: `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\`
3. Restart PowerPoint
4. Reload add-in

### Issue: API rate limits
**Solution:** Add delays between API calls or implement caching

## 📊 Example Use Cases

### 1. Quarterly Business Review
```
Input: "Create a Q4 2025 business review covering revenue growth, 
key wins, challenges faced, and Q1 2026 strategy. Target audience 
is executive team. Include data visualizations."

Result: 12-slide presentation with:
- Title slide
- Executive summary
- Revenue charts
- Key achievements
- Challenges & solutions
- Q1 strategy
- Action items
```

### 2. Educational Presentation
```
Input: "Introduction to Machine Learning for beginners. Cover basic 
concepts, types of ML, real-world applications, and getting started 
resources. Academic tone."

Result: 15-slide presentation with:
- Introduction
- What is ML
- Types: Supervised, Unsupervised, Reinforcement
- Applications
- Getting started guide
```

## 🚢 Production Deployment

### 1. Build for Production
```bash
npm run build
```

### 2. Host Files
Upload `dist/` folder to HTTPS server

### 3. Update Manifest
Replace `https://localhost:3000` with your production URL

### 4. Distribute
- Share manifest.xml with users
- Or publish to Microsoft AppSource

## 💡 Tips for Better Results

1. **Be Specific**: "Quarterly sales review for Q4 2025" > "Sales presentation"
2. **Include Context**: Mention audience, purpose, key points
3. **Set Preferences**: Choose appropriate tone and slide count
4. **Enable Research**: For data-driven presentations
5. **Review & Edit**: Always review AI-generated content

## 📚 Additional Resources

- **Full Documentation**: See README.md
- **VS Code Setup**: See VSCODE_GUIDE.md
- **Technical Spec**: See powerpoint-ai-addin-spec.md
- **Office Add-ins Docs**: https://docs.microsoft.com/en-us/office/dev/add-ins/
- **Claude API Docs**: https://docs.anthropic.com/
- **Fluent UI**: https://developer.microsoft.com/en-us/fluentui

## 🤝 Need Help?

- Check console for errors (F12 in browser)
- Review Office.js errors in PowerPoint
- Verify API key is correct
- Ensure internet connection for API calls

---

**Happy building! 🎉**

Start with a simple test:
```
"Create a 5-slide introduction to renewable energy for high school students"
```

See the magic happen! ✨
