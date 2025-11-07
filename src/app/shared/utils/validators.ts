import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  static bpRange(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const [systolic, diastolic] = value.split('/').map(Number);
      
      if (isNaN(systolic) || isNaN(diastolic)) {
        return { invalidFormat: true };
      }

      if (systolic < 50 || systolic > 250) {
        return { systolicOutOfRange: true };
      }

      if (diastolic < 30 || diastolic > 150) {
        return { diastolicOutOfRange: true };
      }

      if (systolic <= diastolic) {
        return { invalidRatio: true };
      }

      return null;
    };
  }

  static glucoseRange(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const num = Number(value);
      if (isNaN(num)) return { invalidNumber: true };

      if (num < 20 || num > 600) {
        return { outOfRange: true };
      }

      return null;
    };
  }

  static spo2Range(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const num = Number(value);
      if (isNaN(num)) return { invalidNumber: true };

      if (num < 0 || num > 100) {
        return { outOfRange: true };
      }

      return null;
    };
  }

  static hrRange(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const num = Number(value);
      if (isNaN(num)) return { invalidNumber: true };

      if (num < 30 || num > 220) {
        return { outOfRange: true };
      }

      return null;
    };
  }

  static painRange(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const num = Number(value);
      if (isNaN(num)) return { invalidNumber: true };

      if (num < 0 || num > 10) {
        return { outOfRange: true };
      }

      return null;
    };
  }

  static weightRange(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const num = Number(value);
      if (isNaN(num)) return { invalidNumber: true };

      if (num < 1 || num > 500) {
        return { outOfRange: true };
      }

      return null;
    };
  }

  static heightRange(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const num = Number(value);
      if (isNaN(num)) return { invalidNumber: true };

      if (num < 50 || num > 250) {
        return { outOfRange: true };
      }

      return null;
    };
  }
}

