/** A completed destructive page is durable progress, not a failed attempt. */
export class DeletionPageComplete extends Error {
  constructor() {
    super('deletion_more_pages');
    this.name = 'DeletionPageComplete';
  }
}
