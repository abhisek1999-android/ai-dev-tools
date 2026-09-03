import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

// The previous version of this spec was untouched Angular boilerplate: it
// asserted `app.title` and a `.content span` element, neither of which this
// component has ever had, so it could never pass.
describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [provideRouter([])],
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the shell: particles, header, main and footer', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-particles')).toBeTruthy();
    expect(el.querySelector('app-header')).toBeTruthy();
    expect(el.querySelector('main')).toBeTruthy();
    expect(el.querySelector('app-footer')).toBeTruthy();
  });

  it('should keep the decorative particle canvas out of the a11y tree', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas');

    expect(canvas).toBeTruthy();
    expect(canvas!.getAttribute('aria-hidden')).toBe('true');
    expect(canvas!.className).toContain('pointer-events-none');
  });
});
