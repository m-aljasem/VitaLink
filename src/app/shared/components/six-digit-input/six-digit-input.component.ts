import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonInput } from '@ionic/angular/standalone';

@Component({
  selector: 'app-six-digit-input',
  templateUrl: './six-digit-input.component.html',
  styleUrls: ['./six-digit-input.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonInput],
})
export class SixDigitInputComponent implements AfterViewInit {
  @Input() code = '';
  @Output() codeChange = new EventEmitter<string>();
  @Output() codeComplete = new EventEmitter<string>();

  digits: string[] = ['', '', '', '', '', ''];
  @ViewChild('input0') input0!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input1') input1!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input2') input2!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input3') input3!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input4') input4!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input5') input5!: ElementRef<HTMLIonInputElement>;

  ngAfterViewInit() {
    if (this.code) {
      this.digits = this.code.split('');
      this.updateCode();
    }
  }

  onInput(index: number, event: any) {
    const value = event.target.value;
    if (value.length > 1) {
      this.digits[index] = value[value.length - 1];
    } else {
      this.digits[index] = value;
    }

    this.updateCode();

    if (value && index < 5) {
      this.focusNext(index);
    }

    if (this.isComplete()) {
      this.codeComplete.emit(this.code);
    }
  }

  onKeyDown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      this.focusPrevious(index);
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');
    
    for (let i = 0; i < 6; i++) {
      this.digits[i] = digits[i] || '';
    }

    this.updateCode();
    if (this.isComplete()) {
      this.codeComplete.emit(this.code);
    } else {
      this.focusNext(Math.min(digits.length - 1, 5));
    }
  }

  private focusNext(index: number) {
    const inputs = [this.input0, this.input1, this.input2, this.input3, this.input4, this.input5];
    if (inputs[index + 1]) {
      setTimeout(() => inputs[index + 1].nativeElement.setFocus(), 10);
    }
  }

  private focusPrevious(index: number) {
    const inputs = [this.input0, this.input1, this.input2, this.input3, this.input4, this.input5];
    if (inputs[index - 1]) {
      setTimeout(() => inputs[index - 1].nativeElement.setFocus(), 10);
    }
  }

  private updateCode() {
    this.code = this.digits.join('');
    this.codeChange.emit(this.code);
  }

  private isComplete(): boolean {
    return this.digits.every(d => d !== '');
  }
}

