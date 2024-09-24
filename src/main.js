
import { LitElement, html, css } from "https://esm.sh/lit@3.2.0";


class FileList extends LitElement {
  static styles = css`
    table {
      border-left: 4px solid #f08;
      padding: 0;
      width: 100%;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    caption {
      font-weight: bold;
      margin-bottom: 0.5em;
      text-align: left;
      padding: 0.5em 1em;
    }
    tr {
      list-style: none;
      padding: 0.5em;
    }
    tr:nth-child(even) {
      background-color: #7772;
    }
    td {
      padding: 0.2em 1em;
      max-width: 20em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  static properties = {
    files: { type: Array }
  };

  constructor() {
    super();
    this.files = [];
  }

  _formatSize(bytes) {
    if (bytes === 0) return "0";
    const sizes = ["b", "kb", "mb", "gb", "tb", "pb", "eb", "zb", "yb"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${parseFloat(value.toFixed(1))} ${sizes[i]}`;
  }

  _formatDate(date) {
    const dateFormat = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "numeric",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    return dateFormat.format(new Date(date));
  }

  _handleOpen(file) {
    // Dispatch a custom event when link is clicked
    this.dispatchEvent(new CustomEvent('file-open', {
      detail: { file },
      bubbles: true,
      composed: true
    }));
  }

  _handleDelete(file) {
    // Dispatch a custom event when delete button is clicked
    this.dispatchEvent(new CustomEvent('file-delete', {
      detail: { file },
      bubbles: true,
      composed: true
    }));
  }

  _calculateTotalSize() {
    return this.files.reduce((total, file) => total + file.size, 0);
  }

  render() {
    const totalSize = this._formatSize(this._calculateTotalSize());
    const fileCount = this.files.length;

    return html`
      <table>
        <caption>
          ${fileCount} ${fileCount === 1 ? 'file' : 'files'}, Total size: ${totalSize}
        </caption>
        ${this.files.map(file => html`
          <tr>
            <td><a 
              @click="${(e) => { this._handleOpen(file); e.preventDefault() }}"
              href="#${file.name}">${file.name}</a></td>
            <td>${this._formatDate(file.lastModified)}</td>
            <td>${this._formatSize(file.size)}</td>
            <td>
              <button @click="${() => this._handleDelete(file)}">delete</button>
            </td>
          </tr>
        `)}
      </table>
    `;
  }
}

customElements.define('opfs-viewer-files', FileList);


class OpfsViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    label {
      display: block;
      margin-bottom: 1em;
    }
  `;

  static properties = {
    files: { type: Array }
  };

  constructor() {
    super();
    this.files = [];
    
    this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" })

    // Listen for messages from the worker
    this.worker.onmessage = this._handleWorkerMessage.bind(this);
  }


  disconnectedCallback() {
    // Terminate the worker when the component is removed from the DOM
    if (this.worker) {
      this.worker.terminate();
      console.log('Worker terminated');
    }
    super.disconnectedCallback();
  }

  _handleWorkerMessage({ data }) {
    switch (data.type) {
      case "scan":
        this.files = data.payload;
        break;

      case "open":

        window.open(data.payload, '_blank')
        break;
    }
  }

  _handleFileDelete(event) {
    const file = event.detail.file;
    console.log(`File to delete: ${file.name}`);
    this.worker.postMessage({ type: "remove", payload: file.name });
  }

  async _handleFileAdd(event) {
    const files = event.target.files;
    for (const file of files) {
      const contents = await file.arrayBuffer();
      this.worker.postMessage(
        {
          type: "add",
          payload: {
            filename: file.name,
            contents,
          },
        },
        [contents]
      );
    }
    event.target.value = ''; // Clear the input
  }

  _handleFileOpen(event) {
    const file = event.detail.file;
    console.log(`File to open: ${file.name}`);
    this.worker.postMessage({ type: "open", payload: file.name });
  }


  render() {
    return html`
      <label>
        Add files
        <input type="file" @change="${this._handleFileAdd}" multiple />
      </label>
      <opfs-viewer-files 
        .files="${this.files}" 
        @file-delete="${this._handleFileDelete}"
        @file-open="${this._handleFileOpen}">
        >
      </opfs-viewer-files>
    `;
  }
}

customElements.define('opfs-viewer', OpfsViewer);
