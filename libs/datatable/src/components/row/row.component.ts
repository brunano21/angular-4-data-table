import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2
} from '@angular/core';
import { DataTableComponent } from '../table/table.component';

@Component({
  selector: '[dataTableRow]',
  templateUrl: './row.component.html',
  styleUrls: ['./row.component.css']
})
export class DataTableRowComponent implements OnInit, OnDestroy {

  public _this = this;

  @Input() item: any;
  @Input() index: number;

  expanded: boolean;

  private _listeners = [];

  // row selection:
  private _selected: boolean;

  @Output() selectedChange = new EventEmitter();
  @Output() rowExpandEvent = new EventEmitter();

  get selected() {
    return this._selected;
  }

  set selected(selected) {
    this._selected = selected;
    this.selectedChange.emit(selected);
  }

  expandButtonClicked(){
    this.expanded = !this.expanded;
    this.rowExpandEvent.emit(this.expanded);
  }

  // other:
  get displayIndex() {
    if (this.dataTable.pagination) {
      return this.dataTable.displayParams.offset + this.index + 1;
    } else {
      return this.index + 1;
    }
  }

  getTooltip() {
    if (this.dataTable.rowTooltip) {
      return this.dataTable.rowTooltip(this.item, this, this.index);
    }
    return '';
  }

  constructor(@Inject(forwardRef(() => DataTableComponent)) public dataTable: DataTableComponent,
              private renderer: Renderer2, private elementRef: ElementRef) {}

  ngOnInit() {
    if (this.dataTable.rowClick.observers.length > 0) {
      this._listeners.push(
        this.renderer.listen(this.elementRef.nativeElement, 'click',
          (event) => this.dataTable.rowClicked(this, event))
      );
    }
    if (this.dataTable.rowDoubleClick.observers.length > 0) {
      this._listeners.push(
        this.renderer.listen(this.elementRef.nativeElement, 'dblclick',
          (event) => this.dataTable.rowDoubleClicked(this, event))
      );
    }
  }

  ngOnDestroy() {
    this.selected = false;
    this._listeners.forEach(fn => fn());
  }
}
