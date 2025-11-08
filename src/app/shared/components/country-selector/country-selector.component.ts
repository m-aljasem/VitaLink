import { Component, Input, Output, EventEmitter, OnInit, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonSelect, IonSelectOption, IonItem, IonLabel 
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { COUNTRIES, Country } from '../../../core/countries.data';

@Component({
  selector: 'app-country-selector',
  templateUrl: './country-selector.component.html',
  styleUrls: ['./country-selector.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    IonSelect, IonSelectOption, IonItem, IonLabel
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CountrySelectorComponent),
      multi: true
    }
  ]
})
export class CountrySelectorComponent implements OnInit, ControlValueAccessor {
  @Input() label: string = '';
  @Input() placeholder: string = '';
  @Output() countryChange = new EventEmitter<string>();

  countries: Country[] = COUNTRIES;
  selectedCountry: string = '';

  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor(private translate: TranslateService) {}

  ngOnInit() {}

  writeValue(value: string): void {
    this.selectedCountry = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Handle disabled state if needed
  }

  onCountrySelect(event: any) {
    const countryCode = event.detail.value;
    this.selectedCountry = countryCode;
    this.onChange(countryCode);
    this.onTouched();
    this.countryChange.emit(countryCode);
  }

  getCountryName(country: Country): string {
    return this.translate.instant(country.nameKey);
  }

  getSelectedCountryName(): string {
    if (!this.selectedCountry) return '';
    const country = this.countries.find(c => c.code === this.selectedCountry);
    return country ? this.getCountryName(country) : '';
  }

  getSelectedCountryFlag(): string {
    if (!this.selectedCountry) return '';
    const country = this.countries.find(c => c.code === this.selectedCountry);
    return country ? country.flag : '';
  }
}

