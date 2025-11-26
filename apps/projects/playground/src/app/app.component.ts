import { Component } from '@angular/core';
import { DiagramViewerComponent } from 'diagram-viewer';
import {JsonPipe} from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DiagramViewerComponent, JsonPipe],
  templateUrl: './app.component.html',
})
export class AppComponent {
  codeText = `
title "Full Stack Application"
                direction LR

                // Services
                UserService [type: "API Gateway"]
                ItemService [type: "Service"]

                Database {
                    Users { id int pk }
                    Items [cache: true] {
                        item_id uuid pk
                        user_id int fk
                    }
                }

                // Edges
                UserService -> ItemService : Get/Create Item
                ItemService <> Items : Read/Write
                ItemService -> Users : Check Auth
                UserService, ItemService -> Logger : emit events
  `;

  lastEvent: any;

  onLoaded(ev: any) {
    this.lastEvent = ev;
    console.log('[diagram loaded]', ev);
  }
}
