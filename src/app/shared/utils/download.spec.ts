import { saveBlob } from './download';

describe('saveBlob', () => {
  it('downloads the file under the given name and lets go of the temporary address', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let link: HTMLAnchorElement | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      link = this;
    });

    saveBlob(new Blob(['x']), 'attendance-ML.xlsx');

    expect(link?.download).toBe('attendance-ML.xlsx');
    expect(link?.href).toBe('blob:report');
    expect(revoke).toHaveBeenCalledWith('blob:report');

    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });
});
