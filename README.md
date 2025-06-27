# Simple Website Template

This is a simple, clean website template with a centered layout, logo, header, and body text.

## Customization

### Changing the Font

To change the font, you have several options:

1. **Using Web-Safe Fonts**
   Edit the `styles.css` file and modify the `font-family` property in the `body` selector:
   ```css
   body {
       font-family: 'Your Font', sans-serif;
   }
   ```

2. **Using Google Fonts**
   - Visit [Google Fonts](https://fonts.google.com/)
   - Choose your desired font
   - Add the font link to the `<head>` section of `index.html`:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Your+Font&display=swap" rel="stylesheet">
   ```
   - Then update the `font-family` in `styles.css`

3. **Using Custom Fonts**
   - Add your font file to the project
   - Add this to your CSS:
   ```css
   @font-face {
       font-family: 'Your Font';
       src: url('path/to/your/font.woff2') format('woff2');
   }
   ```

### Other Customizations

- Replace `logo.png` with your own logo file
- Modify the content in `index.html`
- Adjust the layout by modifying the `max-width` and `padding` values in `styles.css`
- Change colors by modifying the `color` and `background-color` properties in `styles.css` 