// @ts-nocheck


function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getVarName(block, field) {
  const id = block.getFieldValue(field);
  const variable = block.workspace.getVariableById(id);
  return sanitizeName(variable?.name || 'var');
}

function getPartOptions() {
  const workspace = Blockly.getMainWorkspace();
  const blocks = workspace.getAllBlocks(false);
  const partNames = [];
  for (let block of blocks) {
    if (block.type === 'spawn_part') {
      const name = block.getFieldValue('PART_NAME');
      if (name && !partNames.includes(name)) {
        partNames.push(name);
      }
    }
  }
  return partNames.length > 0 ? partNames.map(name => [name, name]) : [['NoParts', 'NoParts']];
}

function updatePartDropdownOptions() {
  const workspace = Blockly.getMainWorkspace();
  const blocks = workspace.getAllBlocks(false);
  const partOptions = getPartOptions();
  const partBlocks = ['spawn_part', 'rotate_part', 'set_part_color', 'event_touched', 'event_part_destroyed', 'is_part_exists', 'check_player_near_part', 'set_part_position', 'get_part_position', 'set_part_size', 'get_part_size', 'create_tween'];
  for (let block of blocks) {
    if (partBlocks.includes(block.type)) {
      const field = block.getField('PART_NAME');
      if (field) {
        field.menuGenerator_ = partOptions;
        const current = field.getValue();
        const exists = partOptions.some(opt => opt[1] === current);
        field.setValue(exists ? current : partOptions[0][1]);
      }
    }
  }
}

function updateTeamDropdownOptions() {
  const workspace = Blockly.getMainWorkspace();
  const blocks = workspace.getAllBlocks(false);
  const teamNames = [];
  for (let block of blocks) {
    if (block.type === 'create_team') {
      const teamName = block.getFieldValue('TEAM_NAME');
      if (teamName && !teamNames.includes(teamName)) {
        teamNames.push(teamName);
      }
    }
  }
  const teamOptions = teamNames.length > 0 ? teamNames.map(name => [name, name]) : [['NoTeams', 'NoTeams']];
  for (let block of blocks) {
    if (block.type === 'set_player_team') {
      const field = block.getField('TEAM');
      if (field) {
        field.menuGenerator_ = teamOptions;
        const current = field.getValue();
        const exists = teamNames.includes(current);
        field.setValue(exists ? current : teamOptions[0][1]);
      }
    }
  }
}

function updateStatusIndicator(status, type = 'info') {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  if (statusDot && statusText) {
    statusText.textContent = status;
    
    // Update dot color based on type
    statusDot.style.background = type === 'success' ? '#27c93f' : 
                                type === 'error' ? '#ff5f57' : 
                                type === 'warning' ? '#ffbd2e' : '#667eea';
  }
}

function saveWorkspace() {
  try {
    const workspace = Blockly.getMainWorkspace();
    const xml = Blockly.Xml.workspaceToDom(workspace);
    const xmlText = Blockly.Xml.domToText(xml);
    localStorage.setItem('blocklyWorkspace', xmlText);
    updateStatusIndicator('Workspace saved!', 'success');
    
    // Show success message
    showNotification('Workspace saved successfully!', 'success');
  } catch (error) {
    updateStatusIndicator('Save failed', 'error');
    showNotification('Failed to save workspace', 'error');
  }
}

function s(block, inputName, indentLevel) {
  let code = '';
  let targetBlock = block.getInputTargetBlock(inputName);
  while (targetBlock) {
    const fn = LuaGen[targetBlock.type];
    if (fn) {
      code += fn(targetBlock, indentLevel) + '\n';
    } else {
      code += `-- Unknown block type: ${targetBlock.type}\n`;
    }
    targetBlock = targetBlock.getNextBlock();
  }
  return code;
}

function loadWorkspace() {
  try {
    const xmlText = localStorage.getItem('blocklyWorkspace');
    if (xmlText) {
      const workspace = Blockly.getMainWorkspace();
      workspace.clear();
      const xml = Blockly.Xml.textToDom(xmlText);
      Blockly.Xml.domToWorkspace(xml, workspace);
      updatePartDropdownOptions();
      updateTeamDropdownOptions();
      generateLua(workspace);
      updateStatusIndicator('Workspace loaded!', 'success');
      showNotification('Workspace loaded successfully!', 'success');
    } else {
      updateStatusIndicator('No saved workspace', 'warning');
      showNotification('No saved workspace found', 'warning');
    }
  } catch (error) {
    updateStatusIndicator('Load failed', 'error');
    showNotification('Failed to load workspace', 'error');
  }
}

function clearWorkspace() {
  if (confirm('Are you sure you want to clear the workspace?')) {
    const workspace = Blockly.getMainWorkspace();
    workspace.clear();
    localStorage.removeItem('blocklyWorkspace');
    document.getElementById('codeOutput').textContent = '-- Lua code will appear here\n-- Drag blocks from the toolbox to start coding!';
    updateStatusIndicator('Workspace cleared', 'info');
    showNotification('Workspace cleared', 'info');
  }
}

function organizeWorkspace() {
  try {
    const workspace = Blockly.getMainWorkspace();
    const blocks = workspace.getTopBlocks(true);
    
    if (blocks.length === 0) {
      showNotification('No blocks to organize', 'warning');
      return;
    }
    
    // Improved organization: arrange blocks in a more logical flow
    let x = 50;
    let y = 50;
    const spacing = 250;
    let maxHeight = 0;
    let currentRowHeight = 0;
    
    blocks.forEach((block, index) => {
      const blockWidth = block.getHeightWidth().width;
      const blockHeight = block.getHeightWidth().height;
      
      // Check if block would go off screen
      if (x + blockWidth > 800) {
        x = 50;
        y += currentRowHeight + 30;
        currentRowHeight = 0;
      }
      
      block.moveBy(x, y);
      currentRowHeight = Math.max(currentRowHeight, blockHeight);
      x += blockWidth + spacing;
    });
    
    updateStatusIndicator('Workspace organized!', 'success');
    showNotification('Blocks organized successfully!', 'success');
  } catch (error) {
    updateStatusIndicator('Organization failed', 'error');
    showNotification('Failed to organize blocks', 'error');
  }
}



function formatCode() {
  try {
    const codeOutput = document.getElementById('codeOutput');
    let code = codeOutput.textContent;
    
    // Basic Lua code formatting
    code = code
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive blank lines
      .replace(/\s+$/gm, '') // Remove trailing whitespace
      .replace(/^\s+/gm, (match) => '    '.repeat(Math.floor(match.length / 4))); // Normalize indentation
    
    codeOutput.textContent = code;
    updateStatusIndicator('Code formatted!', 'success');
    showNotification('Code formatted successfully!', 'success');
  } catch (error) {
    updateStatusIndicator('Format failed', 'error');
    showNotification('Failed to format code', 'error');
  }
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span class="notification-message">${message}</span>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('show'), 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Define blocks only if they don't already exist
const existingBlockTypes = new Set(Object.keys(Blockly.Blocks));

const blocksToDefine = [
  {
    "type": "spawn_part",
    "message0": "Spawn part named %1 at X: %2 Y: %3 Z: %4",
    "args0": [
      { "type": "field_input", "name": "PART_NAME", "text": "MyPart" },
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230,
    "onchange": function(event) {
      if (event.type === Blockly.Events.BLOCK_CHANGE || event.type === Blockly.Events.BLOCK_CREATE) {
        const partName = this.getFieldValue('PART_NAME');
        const workspace = this.workspace;
        const blocks = workspace.getAllBlocks(false);
        let partCount = 0;
        for (let block of blocks) {
          if (block.type === 'spawn_part' && block.getFieldValue('PART_NAME') === partName) {
            partCount++;
          }
        }
        if (partCount > 1) {
          const useExisting = confirm(`Part "${partName}" already exists. Use existing part or create a new one? Click OK to use existing, Cancel to create new.`);
          if (useExisting) {
            this.setDisabled(true);
            alert(`Using existing part "${partName}". This block is disabled.`);
          } else {
            this.setFieldValue(partName + '_' + Date.now(), 'PART_NAME');
            alert(`Created new part with unique name to avoid conflict.`);
          }
        }
      }
    }
  },
  {
    "type": "rotate_part",
    "message0": "Rotate part %1 by X: %2 Y: %3 Z: %4 degrees",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230
  },
  {
    "type": "create_table",
    "message0": "create table %1 with values %2 %3 %4",
    "args0": [
      { "type": "field_input", "name": "TABLENAME", "text": "myTable" },
      { "type": "input_value", "name": "VALUE1" },
      { "type": "input_value", "name": "VALUE2" },
      { "type": "input_value", "name": "VALUE3" }
    ],
    "output": null,
    "colour": 200
  },
  {
    "type": "set_part_position",
    "message0": "Set part %1 position to X: %2 Y: %3 Z: %4",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230
  },
  {
    "type": "fire_remote_event",
    "message0": "Fire remote event %1 with data %2",
    "args0": [
      { "type": "field_input", "name": "EVENT_NAME", "text": "RemoteEventName" },
      { "type": "input_value", "name": "DATA" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 290
  },
  {
    "type": "on_remote_event_received",
    "message0": "When remote event %1 is received do %2",
    "args0": [
      { "type": "field_input", "name": "EVENT_NAME", "text": "RemoteEventName" },
      { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 290
  },
  {
    "type": "sync_player_data",
    "message0": "Sync data %1 to player %2",
    "args0": [
      { "type": "input_value", "name": "DATA" },
      { "type": "input_value", "name": "PLAYER" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 290
  },
  {
    "type": "broadcast_to_all_clients",
    "message0": "Broadcast event %1 with data %2",
    "args0": [
      { "type": "field_input", "name": "EVENT_NAME", "text": "RemoteEventName" },
      { "type": "input_value", "name": "DATA" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 290
  },
  {
    "type": "get_part_position",
    "message0": "Get part %1 position %2",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "field_dropdown", "name": "COMPONENT", "options": [["X", "X"], ["Y", "Y"], ["Z", "Z"]] }
    ],
    "output": null,
    "colour": 230
  },
  {
    "type": "set_part_color",
    "message0": "Set color of part %1 to R: %2 G: %3 B: %4",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "input_value", "name": "R" },
      { "type": "input_value", "name": "G" },
      { "type": "input_value", "name": "B" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230
  },
  {
    "type": "get_part_color",
    "message0": "Get part %1 color %2",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "field_dropdown", "name": "COMPONENT", "options": [["R", "R"], ["G", "G"], ["B", "B"]] }
    ],
    "output": null,
    "colour": 230
  },
  {
    "type": "set_part_size",
    "message0": "Set part %1 size to X: %2 Y: %3 Z: %4",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230
  },
  {
    "type": "get_part_size",
    "message0": "Get part %1 size %2",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "field_dropdown", "name": "COMPONENT", "options": [["X", "X"], ["Y", "Y"], ["Z", "Z"]] }
    ],
    "output": null,
    "colour": 230
  },
  {
    "type": "create_tween",
    "message0": "Tween part %1 %2 to X: %3 Y: %4 Z: %5 over %6 seconds with %7 %8",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions },
      { "type": "field_dropdown", "name": "PROPERTY", "options": [["Position", "Position"], ["Size", "Size"], ["Orientation", "Orientation"]] },
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" },
      { "type": "input_value", "name": "TIME" },
      { "type": "field_dropdown", "name": "EASING_STYLE", "options": [["Linear", "Linear"], ["Sine", "Sine"], ["Quad", "Quad"], ["Cubic", "Cubic"]] },
      { "type": "field_dropdown", "name": "EASING_DIRECTION", "options": [["In", "In"], ["Out", "Out"], ["InOut", "InOut"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230
  },
  {
    "type": "get_table_value",
    "message0": "get value from table %1 at index %2",
    "args0": [
      { "type": "input_value", "name": "TABLE" },
      { "type": "input_value", "name": "INDEX" }
    ],
    "output": null,
    "colour": 250
  },
  {
    "type": "math_random_range",
    "message0": "random from %1 to %2",
    "args0": [
      { "type": "input_value", "name": "MIN" },
      { "type": "input_value", "name": "MAX" }
    ],
    "output": null,
    "colour": 270
  },
  {
    "type": "custom_math_floor",
    "message0": "floor(%1)",
    "args0": [{ "type": "input_value", "name": "NUM" }],
    "output": null,
    "colour": 270
  },
  {
    "type": "custom_math_round",
    "message0": "round(%1)",
    "args0": [{ "type": "input_value", "name": "NUM" }],
    "output": null,
    "colour": 270
  },
  {
    "type": "text_input",
    "message0": "To String %1",
    "args0": [
      { "type": "field_input", "name": "TEXT", "text": "hello" }
    ],
    "output": null,
    "colour": 160
  },
  {
    "type": "print_statement",
    "message0": "print %1",
    "args0": [
      { "type": "input_value", "name": "TEXT" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 160
  },
  {
    "type": "event_touched",
    "message0": "When part %1 is touched do",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions }
    ],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_clickdetector",
    "message0": "when part %1 clicked do",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions }
    ],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_player_added",
    "message0": "when player joins do",
    "args0": [],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "wait",
    "message0": "wait for %1 seconds",
    "args0": [
      { "type": "input_value", "name": "TIME", "check": "Number" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200,
    "tooltip": "Pauses the script execution for the specified number of seconds.",
    "helpUrl": ""
  },
  {
    "type": "event_character_added",
    "message0": "when character spawns do",
    "args0": [],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_key_pressed",
    "message0": "when key %1 pressed do",
    "args0": [{ "type": "field_input", "name": "KEY", "text": "E" }],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 260
  },
  {
    "type": "is_player_in_zone",
    "message0": "is player %1 inside zone %2",
    "args0": [
      { "type": "input_value", "name": "PLAYER" },
      { "type": "input_value", "name": "ZONE" }
    ],
    "output": "Boolean",
    "colour": 210
  },
  {
    "type": "event_timer",
    "message0": "every %1 seconds do",
    "args0": [{ "type": "input_value", "name": "TIME" }],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_player_removing",
    "message0": "when player leaves do",
    "args0": [],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_player_damaged",
    "message0": "when player takes damage do",
    "args0": [],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_player_jumped",
    "message0": "when player jumps do",
    "args0": [],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_player_landed",
    "message0": "when player lands do",
    "args0": [],
    "message1": "%1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "event_part_destroyed",
    "message0": "when part %1 is destroyed do",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions }
    ],
    "message1": "%1",
    "args1": [
      { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null,
    "colour": 260
  },
  {
    "type": "get_player",
    "message0": "get current player",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_walkspeed",
    "message0": "set player walkspeed to %1",
    "args0": [{ "type": "input_value", "name": "SPEED" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_walkspeed",
    "message0": "get player walkspeed",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_health",
    "message0": "set player health to %1",
    "args0": [{ "type": "input_value", "name": "HEALTH" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_health",
    "message0": "get player health",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_maxhealth",
    "message0": "set player max health to %1",
    "args0": [{ "type": "input_value", "name": "MAXHEALTH" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_maxhealth",
    "message0": "get player max health",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_jumppower",
    "message0": "set player jump power to %1",
    "args0": [{ "type": "input_value", "name": "JUMPPOWER" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_jumppower",
    "message0": "get player jump power",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_hipheight",
    "message0": "set player hip height to %1",
    "args0": [{ "type": "input_value", "name": "HIPHEIGHT" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_hipheight",
    "message0": "get player hip height",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_position",
    "message0": "set player position to X: %1 Y: %2 Z: %3",
    "args0": [
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_position",
    "message0": "get player position %1",
    "args0": [
      { "type": "field_dropdown", "name": "COMPONENT", "options": [["X", "X"], ["Y", "Y"], ["Z", "Z"]] }
    ],
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_rotation",
    "message0": "set player rotation to Y: %1 degrees",
    "args0": [{ "type": "input_value", "name": "YROT" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_rotation",
    "message0": "get player rotation Y",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_team",
    "message0": "set player team to %1",
    "args0": [
      { "type": "field_dropdown", "name": "TEAM", "options": [['NoTeams', 'NoTeams']] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_team",
    "message0": "get player team name",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_cameramode",
    "message0": "set camera mode to %1",
    "args0": [
      { "type": "field_dropdown", "name": "MODE", "options": [["Classic", "Classic"], ["LockFirstPerson", "LockFirstPerson"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_cameramode",
    "message0": "get camera mode",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_camerazoom",
    "message0": "set camera zoom to %1",
    "args0": [{ "type": "input_value", "name": "ZOOM" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_camerazoom",
    "message0": "get camera zoom",
    "output": null,
    "colour": 200
  },
  {
    "type": "teleport_player",
    "message0": "teleport player to X: %1 Y: %2 Z: %3",
    "args0": [
      { "type": "input_value", "name": "X" },
      { "type": "input_value", "name": "Y" },
      { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "respawn_player",
    "message0": "respawn player",
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "give_player_tool",
    "message0": "give player tool named %1",
    "args0": [{ "type": "field_input", "name": "TOOL", "text": "ToolName" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "remove_player_tool",
    "message0": "remove player tool named %1",
    "args0": [{ "type": "field_input", "name": "TOOL", "text": "ToolName" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "set_player_leaderstat",
    "message0": "set leaderstat %1 to %2",
    "args0": [
      { "type": "field_input", "name": "STAT", "text": "Score" },
      { "type": "input_value", "name": "VALUE" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_leaderstat",
    "message0": "get leaderstat %1",
    "args0": [{ "type": "field_input", "name": "STAT", "text": "Score" }],
    "output": null,
    "colour": 200
  },
  {
    "type": "add_player_effect",
    "message0": "add effect %1 to player",
    "args0": [
      { "type": "field_dropdown", "name": "EFFECT", "options": [["ForceField", "ForceField"], ["Smoke", "Smoke"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "remove_player_effect",
    "message0": "remove effect %1 from player",
    "args0": [
      { "type": "field_dropdown", "name": "EFFECT", "options": [["ForceField", "ForceField"], ["Smoke", "Smoke"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "play_player_animation",
    "message0": "play animation ID %1 on player",
    "args0": [{ "type": "field_input", "name": "ANIMID", "text": "1234567890" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "stop_player_animation",
    "message0": "stop animation ID %1 on player",
    "args0": [{ "type": "field_input", "name": "ANIMID", "text": "1234567890" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "create_team",
    "message0": "create team named %1 with color %2 %3 %4",
    "args0": [
      { "type": "field_input", "name": "TEAM_NAME", "text": "RedTeam" },
      { "type": "input_value", "name": "R" },
      { "type": "input_value", "name": "G" },
      { "type": "input_value", "name": "B" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "set_player_transparency",
    "message0": "set player transparency to %1",
    "args0": [{ "type": "input_value", "name": "TRANSPARENCY" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_transparency",
    "message0": "get player transparency",
    "output": null,
    "colour": 200
  },
  {
    "type": "set_player_collision",
    "message0": "set player collision %1",
    "args0": [
      { "type": "field_dropdown", "name": "COLLISION", "options": [["On", "true"], ["Off", "false"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200
  },
  {
    "type": "get_player_collision",
    "message0": "get player collision",
    "output": null,
    "colour": 200
  },
  {
    "type": "logic_compare",
    "message0": "%1 %2 %3",
    "args0": [
      { "type": "input_value", "name": "A" },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          [">", "GT"],
          ["≤", "LTE"],
          ["≥", "GTE"]
        ]
      },
      { "type": "input_value", "name": "B" }
    ],
    "inputsInline": true,
    "output": null,
    "colour": 210
  },
  {
    "type": "logic_compare_advanced",
    "message0": "%1 %2 %3",
    "args0": [
      { "type": "input_value", "name": "A" },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["≠", "NEQ"],
          ["<", "LT"],
          [">", "GT"],
          ["≤", "LTE"],
          ["≥", "GTE"]
        ]
      },
      { "type": "input_value", "name": "B" }
    ],
    "inputsInline": true,
    "output": null,
    "colour": 210
  },
  {
    "type": "set_table_value",
    "message0": "set value in table %1 at index %2 to %3",
    "args0": [
      { "type": "input_value", "name": "TABLE" },
      { "type": "input_value", "name": "INDEX" },
      { "type": "input_value", "name": "VALUE" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 250
  },
  {
    "type": "logic_and",
    "message0": "%1 and %2",
    "args0": [
      { "type": "input_value", "name": "A" },
      { "type": "input_value", "name": "B" }
    ],
    "inputsInline": true,
    "output": null,
    "colour": 210
  },
  {
    "type": "logic_or",
    "message0": "%1 or %2",
    "args0": [
      { "type": "input_value", "name": "A" },
      { "type": "input_value", "name": "B" }
    ],
    "inputsInline": true,
    "output": null,
    "colour": 210
  },
  {
    "type": "logic_not",
    "message0": "not %1",
    "args0": [{ "type": "input_value", "name": "BOOL" }],
    "output": null,
    "colour": 210
  },
  {
    "type": "is_player_jumping",
    "message0": "is player jumping",
    "output": null,
    "colour": 210
  },
  {
    "type": "is_player_grounded",
    "message0": "is player grounded",
    "output": null,
    "colour": 210
  },
  {
    "type": "is_part_exists",
    "message0": "is part %1 in workspace",
    "args0": [
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions }
    ],
    "output": null,
    "colour": 210
  },
  {
    "type": "text_raw",
    "message0": "text value %1",
    "args0": [
      {
        "type": "field_input",
        "name": "RAW_TEXT",
        "text": "PlayerName"
      }
    ],
    "output": null,
    "colour": 160
  },
  {
    "type": "check_player_near_part",
    "message0": "is player within %1 studs of part %2",
    "args0": [
      { "type": "input_value", "name": "DISTANCE" },
      { "type": "field_dropdown", "name": "PART_NAME", "options": getPartOptions }
    ],
    "output": null,
    "colour": 210
  },
  {
    "type": "check_player_stat",
    "message0": "leaderstat %1 %2 %3",
    "args0": [
      { "type": "field_input", "name": "STAT", "text": "Score" },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          [">", "GT"],
          ["≤", "LTE"],
          ["≥", "GTE"]
        ]
      },
      { "type": "input_value", "name": "VALUE" }
    ],
    "inputsInline": true,
    "output": null,
    "colour": 210
  },
  {
    "type": "print_table_values",
    "message0": "print all values in table %1",
    "args0": [
      { "type": "input_value", "name": "TABLE" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 250
  },
  {
    "type": "custom_condition",
    "message0": "condition %1",
    "args0": [{ "type": "field_input", "name": "CONDITION", "text": "true" }],
    "output": null,
    "colour": 210
  },
  // Leaderboard Blocks
  {
    "type": "create_leaderboard",
    "message0": "Create leaderboard %1 with stat %2 sort %3 update every %4 seconds",
    "args0": [
      { "type": "field_input", "name": "LEADERBOARD_NAME", "text": "myLeaderboard" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "field_dropdown", "name": "SORT_ORDER", "options": [["Descending", "DESC"], ["Ascending", "ASC"]] },
      { "type": "input_value", "name": "UPDATE_INTERVAL" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "add_leaderboard_stat",
    "message0": "Add leaderboard stat %1 with initial value %2 type %3",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Kills" },
      { "type": "input_value", "name": "INITIAL_VALUE" },
      { "type": "field_dropdown", "name": "STAT_TYPE", "options": [["Integer", "INT"], ["Number", "FLOAT"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "set_leaderboard_value",
    "message0": "Set %1 leaderboard %2 to %3",
    "args0": [
      { "type": "input_value", "name": "PLAYER" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "input_value", "name": "VALUE" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "get_leaderboard_value",
    "message0": "Get %1 leaderboard %2",
    "args0": [
      { "type": "input_value", "name": "PLAYER" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" }
    ],
    "output": null,
    "colour": 180
  },
  {
    "type": "increment_leaderboard_value",
    "message0": "Add %1 to %2 leaderboard %3",
    "args0": [
      { "type": "input_value", "name": "AMOUNT" },
      { "type": "input_value", "name": "PLAYER" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "decrement_leaderboard_value",
    "message0": "Subtract %1 from %2 leaderboard %3",
    "args0": [
      { "type": "input_value", "name": "AMOUNT" },
      { "type": "input_value", "name": "PLAYER" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "get_leaderboard_rank",
    "message0": "Get %1 rank in leaderboard %2",
    "args0": [
      { "type": "input_value", "name": "PLAYER" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" }
    ],
    "output": null,
    "colour": 180
  },
  {
    "type": "get_top_players",
    "message0": "Get top %1 players in leaderboard %2",
    "args0": [
      { "type": "input_value", "name": "COUNT" },
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" }
    ],
    "output": null,
    "colour": 180
  },
  {
    "type": "reset_leaderboard",
    "message0": "Reset leaderboard %1 to %2",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "input_value", "name": "RESET_VALUE" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "delete_leaderboard",
    "message0": "Delete leaderboard %1",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "leaderboard_changed_event",
    "message0": "When leaderboard %1 changes do %2",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "display_leaderboard_gui",
    "message0": "Display leaderboard GUI for %1 titled %2 max entries %3",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "field_input", "name": "TITLE", "text": "Top Players" },
      { "type": "input_value", "name": "MAX_ENTRIES" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "update_leaderboard_display",
    "message0": "Update leaderboard display for %1 GUI %2",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "field_input", "name": "GUI_NAME", "text": "LeaderboardGUI" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "sort_leaderboard",
    "message0": "Sort leaderboard %1 by %2",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "field_dropdown", "name": "SORT_ORDER", "options": [["Descending", "DESC"], ["Ascending", "ASC"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "export_leaderboard_data",
    "message0": "Export leaderboard %1 as %2",
    "args0": [
      { "type": "field_input", "name": "STAT_NAME", "text": "Score" },
      { "type": "field_dropdown", "name": "FORMAT", "options": [["JSON", "JSON"], ["CSV", "CSV"], ["Table", "TABLE"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180
  },
  {
    "type": "math_add",
    "message0": "%1 + %2",
    "args0": [
      { "type": "input_value", "name": "A" },
      { "type": "input_value", "name": "B" }
    ],
    "output": null,
    "colour": 270
  },
  {
    "type": "math_subtract",
    "message0": "%1 - %2",
    "args0": [
      { "type": "input_value", "name": "A" },
      { "type": "input_value", "name": "B" }
    ],
    "output": null,
    "colour": 270
  },
  {
    "type": "math_multiply",
    "message0": "%1 × %2",
    "args0": [
      { "type": "input_value", "name": "A" },
      { "type": "input_value", "name": "B" }
    ],
    "output": null,
    "colour": 270
  },
  {
    "type": "math_divide",
    "message0": "%1 ÷ %2",
    "args0": [
      { "type": "input_value", "name": "A" },
      { "type": "input_value", "name": "B" }
    ],
    "output": null,
    "colour": 270
  },
  {
    "type": "math_arithmetic",
    "message0": "%1 %2 %3",
    "args0": [
      { "type": "input_value", "name": "A" },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["ADD", "ADD"],
          ["MINUS", "MINUS"],
          ["MULTIPLY", "MULTIPLY"],
          ["DIVIDE", "DIVIDE"]
        ]
      },
      { "type": "input_value", "name": "B" }
    ],
    "inputsInline": true,
    "output": null,
    "colour": 270
  }
];

// Filter out blocks that already exist
const newBlocksToDefine = blocksToDefine.filter(block => !existingBlockTypes.has(block.type));

// Only define blocks if there are new ones
if (newBlocksToDefine.length > 0) {
  Blockly.defineBlocksWithJsonArray(newBlocksToDefine);
}

const v = (block, name) => {
  const target = block.getInputTargetBlock(name);
  if (!target) return '0';
  const gen = LuaGen[target.type];
  return gen ? gen(target) : '-- unknown';
};

const LuaGen = {
  'spawn_part': (b, vars, indentLevel = 1) => {
    const name = b.getFieldValue('PART_NAME');
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    if (vars && vars.has && !vars.has(name)) {
      vars.add(name);
      return `local ${name} = Instance.new("Part")\n` +
             `${'    '.repeat(indentLevel)}${name}.Anchored = true\n` +
             `${'    '.repeat(indentLevel)}${name}.Position = Vector3.new(${x}, ${y}, ${z})\n` +
             `${'    '.repeat(indentLevel)}${name}.Parent = workspace`;
    } else {
      return `${name} = Instance.new("Part")\n` +
             `${'    '.repeat(indentLevel)}${name}.Anchored = true\n` +
             `${'    '.repeat(indentLevel)}${name}.Position = Vector3.new(${x}, ${y}, ${z})\n` +
             `${'    '.repeat(indentLevel)}${name}.Parent = workspace`;
    }
  },
  'rotate_part': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    return `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}part.CFrame = part.CFrame * CFrame.Angles(math.rad(${x}), math.rad(${y}), math.rad(${z}))\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'set_part_position': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    return `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}part.Position = Vector3.new(${x}, ${y}, ${z})\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'text_raw': b => {
    const raw = b.getFieldValue('RAW_TEXT');
    return raw;
  },
  'fire_remote_event': (b, vars, indentLevel = 1) => {
    const eventName = b.getFieldValue('EVENT_NAME');
    const data = v(b, 'DATA');
    return `${'    '.repeat(indentLevel)}game.ReplicatedStorage:WaitForChild("${eventName}"):FireServer(${data})`;
  },
  'on_remote_event_received': (b, vars, indentLevel = 1) => {
    const eventName = b.getFieldValue('EVENT_NAME');
    const body = s(b, 'DO', indentLevel + 1);
    return `game.ReplicatedStorage:WaitForChild("${eventName}").OnServerEvent:Connect(function(player, data)\n` +
           `${body}\n` +
           `${'    '.repeat(indentLevel)}end)`;
  },
  'sync_player_data': (b, vars, indentLevel = 1) => {
    const data = v(b, 'DATA');
    const player = v(b, 'PLAYER');
    return `${'    '.repeat(indentLevel)}${player}.Data = ${data}`;
  },
  'broadcast_to_all_clients': (b, vars, indentLevel = 1) => {
    const eventName = b.getFieldValue('EVENT_NAME');
    const data = v(b, 'DATA');
    return `${'    '.repeat(indentLevel)}game.ReplicatedStorage:WaitForChild("${eventName}"):FireAllClients(${data})`;
  },
  'create_table': (b, vars) => {
    const tableName = b.getFieldValue('TABLENAME');
    const v1 = v(b, 'VALUE1');
    const v2 = v(b, 'VALUE2');
    const v3 = v(b, 'VALUE3');
    if (vars && vars.has && !vars.has(tableName)) {
      vars.add(tableName);
      return `local ${tableName} = {${v1}, ${v2}, ${v3}}`;
    } else {
      return `${tableName} = {${v1}, ${v2}, ${v3}}`;
    }
  },
  'print_table_values': (b, vars, indentLevel = 1) => {
    const table = v(b, 'TABLE');
    return `for i, v in pairs(${table}) do\n` +
           `${'    '.repeat(indentLevel)}print(i, v)\n` +
           `end`;
  },
  'get_part_position': (b) => {
    const partName = b.getFieldValue('PART_NAME');
    const component = b.getFieldValue('COMPONENT');
    return `(workspace:FindFirstChild("${partName}") and workspace:FindFirstChild("${partName}").Position.${component} or 0)`;
  },
  'set_part_color': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const r = v(b, 'R');
    const g = v(b, 'G');
    const bVal = v(b, 'B');
    return `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}part.BrickColor = BrickColor.new(Color3.fromRGB(${r}, ${g}, ${bVal}))\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'wait': (block, vars, indentLevel = 1) => {
    const indent = '    '.repeat(indentLevel);
    const time = v(block, 'TIME');
    return `${indent}task.wait(${time})`;
  },
  'get_part_color': (b) => {
    const partName = b.getFieldValue('PART_NAME');
    const component = b.getFieldValue('COMPONENT');
    return `(workspace:FindFirstChild("${partName}") and workspace:FindFirstChild("${partName}").BrickColor.Color.${component} * 255 or 0)`;
  },
  'set_part_size': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    return `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}part.Size = Vector3.new(${x}, ${y}, ${z})\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_part_size': (b) => {
    const partName = b.getFieldValue('PART_NAME');
    const component = b.getFieldValue('COMPONENT');
    return `(workspace:FindFirstChild("${partName}") and workspace:FindFirstChild("${partName}").Size.${component} or 0)`;
  },
  'create_tween': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const property = b.getFieldValue('PROPERTY');
    const easingStyle = b.getFieldValue('EASING_STYLE');
    const easingDirection = b.getFieldValue('EASING_DIRECTION');
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    const time = v(b, 'TIME');
    return `local tweenService = game:GetService("TweenService")\n` +
           `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}local tweenInfo = TweenInfo.new(${time}, Enum.EasingStyle.${easingStyle}, Enum.EasingDirection.${easingDirection})\n` +
           `${'    '.repeat(indentLevel)}local tween = tweenService:Create(part, tweenInfo, {${property} = Vector3.new(${x}, ${y}, ${z})})\n` +
           `${'    '.repeat(indentLevel)}tween:Play()\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'math_number': (b) => b.getFieldValue('NUM'),
  'math_random_range': (b) => `math.random(${v(b, 'MIN')}, ${v(b, 'MAX')})`,
  'custom_math_floor': (b) => `math.floor(${v(b, 'NUM')})`,
  'custom_math_round': (b) => `math.floor(${v(b, 'NUM')} + 0.5)`,
  'text_input': (b) => `"${b.getFieldValue('TEXT')}"`,
  'print_statement': (b, vars, indentLevel = 1) => `print(${v(b, 'TEXT')})`,
  'logic_compare': (b) => {
    const op = b.getFieldValue('OP');
    const a = v(b, 'A');
    const bVal = v(b, 'B');
    switch(op) {
      case 'EQ': return `${a} == ${bVal}`;
      case 'NEQ': return `${a} ~= ${bVal}`;
      case 'LT': return `${a} < ${bVal}`;
      case 'GT': return `${a} > ${bVal}`;
      case 'LTE': return `${a} <= ${bVal}`;
      case 'GTE': return `${a} >= ${bVal}`;
      default: return '-- unknown operator';
    }
  },
  'logic_compare_advanced': (b) => {
    const op = b.getFieldValue('OP');
    const a = v(b, 'A');
    const bVal = v(b, 'B');
    switch(op) {
      case 'NEQ': return `${a} ~= ${bVal}`;
      case 'LT': return `${a} < ${bVal}`;
      case 'GT': return `${a} > ${bVal}`;
      case 'LTE': return `${a} <= ${bVal}`;
      case 'GTE': return `${a} >= ${bVal}`;
      default: return '-- unknown operator';
    }
  },
  'set_table_value': (b, vars, indentLevel = 1) => {
    const table = v(b, 'TABLE');
    const index = v(b, 'INDEX');
    const value = v(b, 'VALUE');
    return `${'    '.repeat(indentLevel)}${table}[${index}] = ${value}`;
  },  
  'logic_and': (b) => `(${v(b, 'A')} and ${v(b, 'B')})`,
  'logic_or': (b) => `(${v(b, 'A')} or ${v(b, 'B')})`,
  'logic_not': (b) => `(not ${v(b, 'BOOL')})`,
  'is_player_jumping': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.Jump or false`,
  'is_player_grounded': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.FloorMaterial ~= Enum.Material.Air or false`,
  'is_part_exists': (b) => {
    const partName = b.getFieldValue('PART_NAME');
    return `(workspace:FindFirstChild("${partName}") ~= nil)`;
  },
  'check_player_near_part': (b) => {
    const dist = v(b, 'DISTANCE');
    const partName = b.getFieldValue('PART_NAME');
    return `(game.Players.LocalPlayer.Character and workspace:FindFirstChild("${partName}") and (workspace:FindFirstChild("${partName}").Position - game.Players.LocalPlayer.Character.HumanoidRootPart.Position).Magnitude <= ${dist})`;
  },
  'create_team': (b, indentLevel = 1) => {
    const name = b.getFieldValue('TEAM_NAME');
    const r = v(b, 'R');
    const g = v(b, 'G');
    const bVal = v(b, 'B');
    return `-- Create team "${name}"\n` +
           `local newTeam = Instance.new("Team")\n` +
           `${'    '.repeat(indentLevel)}newTeam.Name = "${name}"\n` +
           `${'    '.repeat(indentLevel)}newTeam.TeamColor = BrickColor.new(Color3.fromRGB(${r}, ${g}, ${bVal}))\n` +
           `${'    '.repeat(indentLevel)}newTeam.Parent = game:GetService("Teams")`;
  },
  'set_player_team': (b, vars, indentLevel = 1) => {
    const team = b.getFieldValue('TEAM');
    return `-- Set player team to ${team}\n` +
           `local targetTeam = game:GetService("Teams"):FindFirstChild("${team}")\n` +
           `if targetTeam then\n` +
           `${'    '.repeat(indentLevel)}game.Players.LocalPlayer.Team = targetTeam\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'check_player_stat': (b) => {
    const stat = b.getFieldValue('STAT');
    const op = b.getFieldValue('OP');
    const value = v(b, 'VALUE');
    let operator;
    switch(op) {
      case 'EQ': operator = '=='; break;
      case 'NEQ': operator = '~='; break;
      case 'LT': operator = '<'; break;
      case 'GT': operator = '>'; break;
      case 'LTE': operator = '<='; break;
      case 'GTE': operator = '>='; break;
      default: operator = '==';
    }
    return `(game.Players.LocalPlayer:FindFirstChild("leaderstats") and game.Players.LocalPlayer.leaderstats:FindFirstChild("${stat}") and game.Players.LocalPlayer.leaderstats.${stat}.Value ${operator} ${value})`;
  },
  'custom_condition': (b) => b.getFieldValue('CONDITION'),
  'controls_if': (b, indentLevel = 1) => {
    let code = `if ${v(b, 'IF0')} then\n${s(b, 'DO0', indentLevel)}`;
    const n = b.elseifCount_ || 0;
    const hasElse = b.elseCount_;
    for (let i = 1; i <= n; i++) {
      code += `\n${'    '.repeat(indentLevel)}elseif ${v(b, 'IF' + i)} then\n${s(b, 'DO' + i, indentLevel)}`;
    }
    if (hasElse) code += `\n${'    '.repeat(indentLevel)}else\n${s(b, 'ELSE', indentLevel)}`;
    return code + `\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_table_value': (b, vars, indentLevel = 1) => {
    const table = v(b, 'TABLE');
    const index = v(b, 'INDEX');
    return `${table}[${index}]`;
  },
  'controls_repeat_ext': (b, vars, indentLevel = 1) => {
    return `for i = 1, ${v(b, 'TIMES')} do\n${s(b, 'DO', indentLevel)}\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'controls_whileUntil': (b, vars, indentLevel = 1) => {
    const op = b.getFieldValue('MODE') === 'UNTIL' ? 'not ' : '';
    return `while ${op}${v(b, 'BOOL')} do\n${s(b, 'DO', indentLevel)}\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'controls_for': (b, vars, indentLevel = 1) => {
    return `for ${getVarName(b, 'VAR')} = ${v(b, 'FROM')}, ${v(b, 'TO')}, ${v(b, 'BY')} do\n${s(b, 'DO', indentLevel)}\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'controls_flow_statements': (b) => b.getFieldValue('FLOW') === 'BREAK' ? 'break' : '-- continue not supported',
  'variables_set': (b, vars, indentLevel = 1) => {
    const name = getVarName(b, 'VAR');
    const value = v(b, 'VALUE');
    if (vars && vars.has && !vars.has(name)) {
      vars.add(name);
      return `local ${name} = ${value}`;
    } else {
      return `${name} = ${value}`;
    }
  },
  'variables_get': (b) => getVarName(b, 'VAR'),
  'procedures_defnoreturn': (b, vars, indentLevel = 1) => {
    return `function ${sanitizeName(b.getFieldValue('NAME'))}()\n${s(b, 'STACK', indentLevel)}\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'procedures_callnoreturn': (b) => `${sanitizeName(b.getFieldValue('NAME'))}()`,
  'procedures_defreturn': (b, vars, indentLevel = 1) => {
    const name = sanitizeName(b.getFieldValue('NAME'));
    const body = s(b, 'STACK', indentLevel);
    const ret = v(b, 'RETURN');
    return `function ${name}()\n${body}\n${'    '.repeat(indentLevel)}return ${ret}\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'procedures_callreturn': (b) => `${sanitizeName(b.getFieldValue('NAME'))}()`,
  'event_touched': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const body = s(b, 'DO', indentLevel + 1);
    return `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}part.Touched:Connect(function(hit)\n` +
           `${body}` +
           `${'    '.repeat(indentLevel)}end)\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'event_clickdetector': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const body = s(b, 'DO', indentLevel);
    return `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}local clickDetector = Instance.new("ClickDetector")\n` +
           `${'    '.repeat(indentLevel)}clickDetector.Parent = part\n` +
           `${'    '.repeat(indentLevel)}clickDetector.MouseClick:Connect(function(player)\n${body}\n${'    '.repeat(indentLevel)}end)\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'event_player_added': (b, vars, indentLevel = 1) => {
    const body = s(b, 'DO', indentLevel + 1);
    return `game.Players.PlayerAdded:Connect(function(player)\n` +
           `${body}` +
           `${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_character_added': (b, vars, indentLevel = 1) => {
    const body = s(b, 'DO', indentLevel + 2);
    return `game.Players.PlayerAdded:Connect(function(player)\n` +
           `${'    '.repeat(indentLevel)}player.CharacterAdded:Connect(function(character)\n` +
           `${body}` +
           `${'    '.repeat(indentLevel)}end)\n${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_key_pressed': (b, vars, indentLevel = 1) => {
    const key = b.getFieldValue('KEY');
    const body = s(b, 'DO', indentLevel);
    return `local UserInputService = game:GetService("UserInputService")\n` +
           `UserInputService.InputBegan:Connect(function(input, gameProcessed)\n` +
           `${'    '.repeat(indentLevel)}if not gameProcessed and input.KeyCode == Enum.KeyCode.${key} then\n${body}\n${'    '.repeat(indentLevel)}end\n${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_timer': (b, vars, indentLevel = 1) => {
    const time = v(b, 'TIME');
    const body = s(b, 'DO', indentLevel);
    return `-- Every ${time} seconds\n` +
           `while true do\n${body}\n${'    '.repeat(indentLevel)}wait(${time})\n${'    '.repeat(indentLevel - 1)}end`;
  },
  'is_player_in_zone': b => {
    const player = v(b, 'PLAYER');
    const zone = v(b, 'ZONE');
    return `(${player}.Character and ${zone} and ${zone}:FindFirstChild('Hitbox') and ${zone}.Hitbox:IsA('Part') and ${zone}.Hitbox:IsPointInside(${player}.Character.HumanoidRootPart.Position) or false)`;
  },
  'event_player_removing': (b, vars, indentLevel = 1) => {
    const body = s(b, 'DO', indentLevel);
    return `-- When player leaves\n` +
           `game.Players.PlayerRemoving:Connect(function(player)\n${body}\n${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_player_damaged': (b, vars, indentLevel = 1) => {
    const body = s(b, 'DO', indentLevel);
    return `-- When player takes damage\n` +
           `game.Players.LocalPlayer.CharacterAdded:Connect(function(character)\n` +
           `${'    '.repeat(indentLevel)}local humanoid = character:FindFirstChild("Humanoid")\n` +
           `${'    '.repeat(indentLevel)}if humanoid then\n` +
           `${'    '.repeat(indentLevel + 1)}humanoid.HealthChanged:Connect(function(health)\n` +
           `${'    '.repeat(indentLevel + 2)}if health < humanoid.MaxHealth then\n${body}\n${'    '.repeat(indentLevel + 2)}end\n` +
           `${'    '.repeat(indentLevel + 1)}end)\n${'    '.repeat(indentLevel)}end)\n${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_player_jumped': (b, vars, indentLevel = 1) => {
    const body = s(b, 'DO', indentLevel);
    return `-- When player jumps\n` +
           `game.Players.LocalPlayer.CharacterAdded:Connect(function(character)\n` +
           `${'    '.repeat(indentLevel)}local humanoid = character:FindFirstChild("Humanoid")\n` +
           `${'    '.repeat(indentLevel)}if humanoid then\n` +
           `${'    '.repeat(indentLevel + 1)}humanoid.Jumping:Connect(function()\n${body}\n${'    '.repeat(indentLevel + 1)}end)\n` +
           `${'    '.repeat(indentLevel)}end)\n${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_player_landed': (b, vars, indentLevel = 1) => {
    const body = s(b, 'DO', indentLevel);
    return `-- When player lands\n` +
           `game.Players.LocalPlayer.CharacterAdded:Connect(function(character)\n` +
           `${'    '.repeat(indentLevel)}local humanoid = character:FindFirstChild("Humanoid")\n` +
           `${'    '.repeat(indentLevel)}if humanoid then\n` +
           `${'    '.repeat(indentLevel + 1)}humanoid.StateChanged:Connect(function(oldState, newState)\n` +
           `${'    '.repeat(indentLevel + 2)}if newState == Enum.HumanoidStateType.Landed then\n${body}\n${'    '.repeat(indentLevel + 2)}end\n` +
           `${'    '.repeat(indentLevel + 1)}end)\n${'    '.repeat(indentLevel)}end)\n${'    '.repeat(indentLevel - 1)}end)`;
  },
  'event_part_destroyed': (b, vars, indentLevel = 1) => {
    const partName = b.getFieldValue('PART_NAME');
    const body = s(b, 'DO', indentLevel);
    return `-- When ${partName} is destroyed\n` +
           `local part = workspace:FindFirstChild("${partName}")\n` +
           `if part then\n` +
           `${'    '.repeat(indentLevel)}part.AncestryChanged:Connect(function(child, parent)\n` +
           `${'    '.repeat(indentLevel + 1)}if parent == nil then\n${body}\n${'    '.repeat(indentLevel + 1)}end\n${'    '.repeat(indentLevel)}end)\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player': (b) => `game.Players.LocalPlayer`,
  'set_player_walkspeed': (b, vars, indentLevel = 1) => {
    const speed = v(b, 'SPEED');
    return `-- Set player walkspeed\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.Humanoid.WalkSpeed = ${speed}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_walkspeed': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.WalkSpeed or 16`,
 'set_player_health': (b, vars, indentLevel = 1) => {
    const health = v(b, 'HEALTH');
    return `-- Set player health\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.Humanoid.Health = ${health}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_health': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.Health or 100`,
  'set_player_maxhealth': (b, vars, indentLevel = 1) => {
    const maxHealth = v(b, 'MAXHEALTH');
    return `-- Set player max health\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.Humanoid.MaxHealth = ${maxHealth}\n` +
           `${'    '.repeat(indentLevel)}player.Character.Humanoid.Health = math.min(player.Character.Humanoid.Health, ${maxHealth})\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_maxhealth': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.MaxHealth or 100`,
  'set_player_jumppower': (b, vars, indentLevel = 1) => {
    const jumpPower = v(b, 'JUMPPOWER');
    return `-- Set player jump power\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.Humanoid.JumpPower = ${jumpPower}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_jumppower': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.JumpPower or 50`,
  'set_player_hipheight': (b, vars, indentLevel = 1) => {
    const hipHeight = v(b, 'HIPHEIGHT');
    return `-- Set player hip height\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.Humanoid.HipHeight = ${hipHeight}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_hipheight': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Humanoid") and game.Players.LocalPlayer.Character.Humanoid.HipHeight or 2`,
  'set_player_position': (b, vars, indentLevel = 1) => {
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    return `-- Set player position\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.HumanoidRootPart.CFrame = CFrame.new(${x}, ${y}, ${z})\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_position': (b) => {
    const component = b.getFieldValue('COMPONENT');
    return `(game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("HumanoidRootPart") and game.Players.LocalPlayer.Character.HumanoidRootPart.Position.${component} or 0)`;
  },
  'set_player_rotation': (b, vars, indentLevel = 1) => {
    const yRot = v(b, 'YROT');
    return `-- Set player rotation\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.HumanoidRootPart.CFrame = CFrame.new(player.Character.HumanoidRootPart.Position) * CFrame.Angles(0, math.rad(${yRot}), 0)\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_rotation': (b) => `(game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("HumanoidRootPart") and math.deg(game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame:ToEulerAnglesYXZ()) or 0)`,
  'set_player_team': (b, indentLevel = 1) => {
    const team = b.getFieldValue('TEAM');
    return `-- Set player team to ${team}\n` +
           `local teamService = game:GetService("Teams")\n` +
           `local team = teamService:FindFirstChild("${team}")\n` +
           `if team then\n` +
           `${'    '.repeat(indentLevel)}game.Players.LocalPlayer.Team = team\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_team': (b) => `game.Players.LocalPlayer.Team and game.Players.LocalPlayer.Team.Name or "None"`,
  'set_player_cameramode': (b, indentLevel = 1) => {
    const mode = b.getFieldValue('MODE');
    return `-- Set camera mode\n` +
           `local player = game.Players.LocalPlayer\n` +
           `${'    '.repeat(indentLevel)}player.CameraMode = Enum.CameraMode.${mode}`;
  },
  'get_player_cameramode': (b) => `tostring(game.Players.LocalPlayer.CameraMode)`,
  'set_player_camerazoom': (b, indentLevel = 1) => {
    const zoom = v(b, 'ZOOM');
    return `-- Set camera zoom\n` +
           `local player = game.Players.LocalPlayer\n` +
           `${'    '.repeat(indentLevel)}player.CameraMaxZoomDistance = ${zoom}\n` +
           `${'    '.repeat(indentLevel)}player.CameraMinZoomDistance = ${zoom}`;
  },
  'get_player_camerazoom': (b) => `(game.Players.LocalPlayer.CameraMaxZoomDistance or 128)`,
  'teleport_player': (b, indentLevel = 1) => {
    const x = v(b, 'X');
    const y = v(b, 'Y');
    const z = v(b, 'Z');
    return `-- Teleport player\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then\n` +
           `${'    '.repeat(indentLevel)}player.Character.HumanoidRootPart.CFrame = CFrame.new(${x}, ${y}, ${z})\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'respawn_player': (b, indentLevel = 1) => {
    return `-- Respawn player\n` +
           `local player = game.Players.LocalPlayer\n` +
           `${'    '.repeat(indentLevel)}player:LoadCharacter()`;
  },
  'give_player_tool': (b, indentLevel = 1) => {
    const toolName = b.getFieldValue('TOOL');
    return `-- Give player tool\n` +
           `local tool = Instance.new("Tool")\n` +
           `${'    '.repeat(indentLevel)}tool.Name = "${toolName}"\n` +
           `${'    '.repeat(indentLevel)}tool.Parent = game.Players.LocalPlayer.Backpack`;
  },
  'remove_player_tool': (b, indentLevel = 1) => {
    const toolName = b.getFieldValue('TOOL');
    return `-- Remove player tool\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Backpack:FindFirstChild("${toolName}") then\n` +
           `${'    '.repeat(indentLevel)}player.Backpack:FindFirstChild("${toolName}"):Destroy()\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'set_player_leaderstat': (b, indentLevel = 1) => {
    const stat = b.getFieldValue('STAT');
    const value = v(b, 'VALUE');
    return `-- Set leaderstat ${stat}\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("${stat}") then\n` +
           `${'    '.repeat(indentLevel)}player.leaderstats.${stat}.Value = ${value}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_leaderstat': (b) => {
    const stat = b.getFieldValue('STAT');
    return `(game.Players.LocalPlayer:FindFirstChild("leaderstats") and game.Players.LocalPlayer.leaderstats:FindFirstChild("${stat}") and game.Players.LocalPlayer.leaderstats.${stat}.Value or 0)`;
  },
  'add_player_effect': (b, indentLevel = 1) => {
    const effect = b.getFieldValue('EFFECT');
    return `-- Add effect ${effect} to player\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character then\n` +
           `${'    '.repeat(indentLevel)}local effect = Instance.new("${effect}")\n` +
           `${'    '.repeat(indentLevel)}effect.Parent = player.Character\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'remove_player_effect': (b, indentLevel = 1) => {
    const effect = b.getFieldValue('EFFECT');
    return `-- Remove effect ${effect} from player\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("${effect}") then\n` +
           `${'    '.repeat(indentLevel)}player.Character:FindFirstChild("${effect}"):Destroy()\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'play_player_animation': (b, indentLevel = 1) => {
    const animId = b.getFieldValue('ANIMID');
    return `-- Play animation on player\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}local animation = Instance.new("Animation")\n` +
           `${'    '.repeat(indentLevel)}animation.AnimationId = "rbxassetid://${animId}"\n` +
           `${'    '.repeat(indentLevel)}local animTrack = player.Character.Humanoid:LoadAnimation(animation)\n` +
           `${'    '.repeat(indentLevel)}animTrack:Play()\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'stop_player_animation': (b, indentLevel = 1) => {
    const animId = b.getFieldValue('ANIMID');
    return `-- Stop animation on player\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character and player.Character:FindFirstChild("Humanoid") then\n` +
           `${'    '.repeat(indentLevel)}for _, animTrack in pairs(player.Character.Humanoid:GetPlayingAnimationTracks()) do\n` +
           `${'    '.repeat(indentLevel + 1)}if animTrack.Animation.AnimationId == "rbxassetid://${animId}" then\n` +
           `${'    '.repeat(indentLevel + 2)}animTrack:Stop()\n` +
           `${'    '.repeat(indentLevel + 1)}end\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'set_player_transparency': (b, indentLevel = 1) => {
    const transparency = v(b, 'TRANSPARENCY');
    return `-- Set player transparency\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character then\n` +
           `${'    '.repeat(indentLevel)}for _, part in pairs(player.Character:GetChildren()) do\n` +
           `${'    '.repeat(indentLevel + 1)}if part:IsA("BasePart") then\n` +
           `${'    '.repeat(indentLevel + 2)}part.Transparency = ${transparency}\n` +
           `${'    '.repeat(indentLevel + 1)}end\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_transparency': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Torso") and game.Players.LocalPlayer.Character.Torso.Transparency or 0`,
  'set_player_collision': (b, indentLevel = 1) => {
    const collision = b.getFieldValue('COLLISION');
    return `-- Set player collision\n` +
           `local player = game.Players.LocalPlayer\n` +
           `if player.Character then\n` +
           `${'    '.repeat(indentLevel)}for _, part in pairs(player.Character:GetChildren()) do\n` +
           `${'    '.repeat(indentLevel + 1)}if part:IsA("BasePart") then\n` +
           `${'    '.repeat(indentLevel + 2)}part.CanCollide = ${collision}\n` +
           `${'    '.repeat(indentLevel + 1)}end\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'get_player_collision': (b) => `game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:FindFirstChild("Torso") and game.Players.LocalPlayer.Character.Torso.CanCollide or true`,
  
  // Leaderboard Blocks
  'create_leaderboard': (b, vars, indentLevel = 1) => {
    const leaderboardName = b.getFieldValue('LEADERBOARD_NAME');
    const statName = b.getFieldValue('STAT_NAME');
    const sortOrder = b.getFieldValue('SORT_ORDER');
    const updateInterval = v(b, 'UPDATE_INTERVAL');
    
    if (vars && vars.has && !vars.has(leaderboardName)) {
      vars.add(leaderboardName);
      return `local ${leaderboardName} = Instance.new("IntValue")\n` +
             `${'    '.repeat(indentLevel)}${leaderboardName}.Name = "${statName}"\n` +
             `${'    '.repeat(indentLevel)}${leaderboardName}.Value = 0\n` +
             `${'    '.repeat(indentLevel)}${leaderboardName}.Parent = game.Players.LocalPlayer:WaitForChild("leaderstats")\n` +
             `${'    '.repeat(indentLevel)}-- Sort order: ${sortOrder === 'ASC' ? 'Ascending' : 'Descending'}\n` +
             `${'    '.repeat(indentLevel)}-- Update interval: ${updateInterval} seconds`;
    } else {
      return `${leaderboardName} = Instance.new("IntValue")\n` +
             `${'    '.repeat(indentLevel)}${leaderboardName}.Name = "${statName}"\n` +
             `${'    '.repeat(indentLevel)}${leaderboardName}.Value = 0\n` +
             `${'    '.repeat(indentLevel)}${leaderboardName}.Parent = game.Players.LocalPlayer:WaitForChild("leaderstats")\n` +
             `${'    '.repeat(indentLevel)}-- Sort order: ${sortOrder === 'ASC' ? 'Ascending' : 'Descending'}\n` +
             `${'    '.repeat(indentLevel)}-- Update interval: ${updateInterval} seconds`;
    }
  },
  
  'add_leaderboard_stat': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const initialValue = v(b, 'INITIAL_VALUE');
    const statType = b.getFieldValue('STAT_TYPE');
    
    // @ts-ignore
    return `local ${statName} = Instance.new("${statType === 'INT' ? 'IntValue' : 'NumberValue'}")\n` +
           `${'    '.repeat(indentLevel)}${statName}.Name = "${statName}"\n` +
           `${'    '.repeat(indentLevel)}${statName}.Value = ${initialValue}\n` +
           `${'    '.repeat(indentLevel)}${statName}.Parent = game.Players.LocalPlayer:WaitForChild("leaderstats")`
  },
  
  'set_leaderboard_value': (b, vars, indentLevel = 1) => {
    const player = v(b, 'PLAYER');
    const statName = b.getFieldValue('STAT_NAME');
    const value = v(b, 'VALUE');
    
    // @ts-ignore
    return `if ${player}:FindFirstChild("leaderstats") and ${player}.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel)}${player}.leaderstats.${statName}.Value = ${value}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  
  'get_leaderboard_value': (b) => {
    const player = v(b, 'PLAYER');
    const statName = b.getFieldValue('STAT_NAME');
    // @ts-ignore
    return `(${player}:FindFirstChild("leaderstats") and ${player}.leaderstats:FindFirstChild("${statName}") and ${player}.leaderstats.${statName}.Value or 0)`;
  },
  
  'increment_leaderboard_value': (b, vars, indentLevel = 1) => {
    const player = v(b, 'PLAYER');
    const statName = b.getFieldValue('STAT_NAME');
    const amount = v(b, 'AMOUNT');
    
    // @ts-ignore
    return `if ${player}:FindFirstChild("leaderstats") and ${player}.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel)}${player}.leaderstats.${statName}.Value = ${player}.leaderstats.${statName}.Value + ${amount}\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  
  'decrement_leaderboard_value': (b, vars, indentLevel = 1) => {
    const player = v(b, 'PLAYER');
    const statName = b.getFieldValue('STAT_NAME');
    const amount = v(b, 'AMOUNT');
    
    return `if ${player}:FindFirstChild("leaderstats") and ${player}.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel)}${player}.leaderstats.${statName}.Value = ${player}.leaderstats.${statName}.Value - ${amount}\n` +
           `${'    '.repeat(indentLevel)}if ${player}.leaderstats.${statName}.Value < 0 then\n` +
           `${'    '.repeat(indentLevel + 1)}${player}.leaderstats.${statName}.Value = 0\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  
  'get_leaderboard_rank': (b) => {
    const player = v(b, 'PLAYER');
    const statName = b.getFieldValue('STAT_NAME');
    return `(function()\n` +
           `    local players = game.Players:GetPlayers()\n` +
           `    local scores = {}\n` +
           `    for _, p in pairs(players) do\n` +
           `        if p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("${statName}") then\n` +
           `            table.insert(scores, {player = p, score = p.leaderstats.${statName}.Value})\n` +
           `        end\n` +
           `    end\n` +
           `    table.sort(scores, function(a, b) return a.score > b.score end)\n` +
           `    for i, data in pairs(scores) do\n` +
           `        if data.player == ${player} then\n` +
           `            return i\n` +
           `        end\n` +
           `    end\n` +
           `    return 0\n` +
           `end)()`;
  },
  
  'get_top_players': (b) => {
    const statName = b.getFieldValue('STAT_NAME');
    const count = v(b, 'COUNT');
    return `(function()\n` +
           `    local players = game.Players:GetPlayers()\n` +
           `    local scores = {}\n` +
           `    for _, p in pairs(players) do\n` +
           `        if p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("${statName}") then\n` +
           `            table.insert(scores, {player = p, score = p.leaderstats.${statName}.Value})\n` +
           `        end\n` +
           `    end\n` +
           `    table.sort(scores, function(a, b) return a.score > b.score end)\n` +
           `    local topPlayers = {}\n` +
           `    for i = 1, math.min(${count}, #scores) do\n` +
           `        table.insert(topPlayers, scores[i])\n` +
           `    end\n` +
           `    return topPlayers\n` +
           `end)()`;
  },
  
  'reset_leaderboard': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const resetValue = v(b, 'RESET_VALUE');
    
    return `for _, player in pairs(game.Players:GetPlayers()) do\n` +
           `${'    '.repeat(indentLevel)}if player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel + 1)}player.leaderstats.${statName}.Value = ${resetValue}\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  
  'delete_leaderboard': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    
    return `for _, player in pairs(game.Players:GetPlayers()) do\n` +
           `${'    '.repeat(indentLevel)}if player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel + 1)}player.leaderstats.${statName}:Destroy()\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  
  'leaderboard_changed_event': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const body = s(b, 'DO', indentLevel + 1);
    
    return `game.Players.PlayerAdded:Connect(function(player)\n` +
           `${'    '.repeat(indentLevel)}player:WaitForChild("leaderstats")\n` +
           `${'    '.repeat(indentLevel)}if player.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel + 1)}player.leaderstats.${statName}.Changed:Connect(function(newValue)\n` +
           `${body}` +
           `${'    '.repeat(indentLevel + 1)}end)\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel - 1)}end)`;
  },
  
  'display_leaderboard_gui': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const title = b.getFieldValue('TITLE');
    const maxEntries = v(b, 'MAX_ENTRIES');
    
    return `local screenGui = Instance.new("ScreenGui")\n` +
           `${'    '.repeat(indentLevel)}screenGui.Name = "${statName}Leaderboard"\n` +
           `${'    '.repeat(indentLevel)}screenGui.Parent = game.Players.LocalPlayer:WaitForChild("PlayerGui")\n` +
           `${'    '.repeat(indentLevel)}local frame = Instance.new("Frame")\n` +
           `${'    '.repeat(indentLevel)}frame.Size = UDim2.new(0, 300, 0, 400)\n` +
           `${'    '.repeat(indentLevel)}frame.Position = UDim2.new(1, -320, 0, 20)\n` +
           `${'    '.repeat(indentLevel)}frame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)\n` +
           `${'    '.repeat(indentLevel)}frame.BorderSizePixel = 0\n` +
           `${'    '.repeat(indentLevel)}frame.Parent = screenGui\n` +
           `${'    '.repeat(indentLevel)}local titleLabel = Instance.new("TextLabel")\n` +
           `${'    '.repeat(indentLevel)}titleLabel.Text = "${title}"\n` +
           `${'    '.repeat(indentLevel)}titleLabel.Size = UDim2.new(1, 0, 0, 40)\n` +
           `${'    '.repeat(indentLevel)}titleLabel.Position = UDim2.new(0, 0, 0, 0)\n` +
           `${'    '.repeat(indentLevel)}titleLabel.BackgroundColor3 = Color3.fromRGB(60, 60, 60)\n` +
           `${'    '.repeat(indentLevel)}titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)\n` +
           `${'    '.repeat(indentLevel)}titleLabel.Font = Enum.Font.SourceSansBold\n` +
           `${'    '.repeat(indentLevel)}titleLabel.TextSize = 18\n` +
           `${'    '.repeat(indentLevel)}titleLabel.Parent = frame`;
  },
  
  'update_leaderboard_display': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const guiName = b.getFieldValue('GUI_NAME');
    
    return `local function updateLeaderboardDisplay()\n` +
           `${'    '.repeat(indentLevel)}local players = game.Players:GetPlayers()\n` +
           `${'    '.repeat(indentLevel)}local scores = {}\n` +
           `${'    '.repeat(indentLevel)}for _, p in pairs(players) do\n` +
           `${'    '.repeat(indentLevel + 1)}if p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel + 2)}table.insert(scores, {player = p, score = p.leaderstats.${statName}.Value})\n` +
           `${'    '.repeat(indentLevel + 1)}end\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel)}table.sort(scores, function(a, b) return a.score > b.score end)\n` +
           `${'    '.repeat(indentLevel)}-- Update GUI with sorted scores\n` +
           `${'    '.repeat(indentLevel - 1)}end\n` +
           `${'    '.repeat(indentLevel - 1)}updateLeaderboardDisplay()`;
  },
  
  'sort_leaderboard': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const sortOrder = b.getFieldValue('SORT_ORDER');
    
    return `local players = game.Players:GetPlayers()\n` +
           `${'    '.repeat(indentLevel)}local scores = {}\n` +
           `${'    '.repeat(indentLevel)}for _, p in pairs(players) do\n` +
           `${'    '.repeat(indentLevel + 1)}if p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel + 2)}table.insert(scores, {player = p, score = p.leaderstats.${statName}.Value})\n` +
           `${'    '.repeat(indentLevel + 1)}end\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel)}table.sort(scores, function(a, b) return a.score ${sortOrder === 'ASC' ? '<' : '>'} b.score end)`;
  },
  
  'export_leaderboard_data': (b, vars, indentLevel = 1) => {
    const statName = b.getFieldValue('STAT_NAME');
    const format = b.getFieldValue('FORMAT');
    
    return `local function exportLeaderboardData()\n` +
           `${'    '.repeat(indentLevel)}local players = game.Players:GetPlayers()\n` +
           `${'    '.repeat(indentLevel)}local data = {}\n` +
           `${'    '.repeat(indentLevel)}for _, p in pairs(players) do\n` +
           `${'    '.repeat(indentLevel + 1)}if p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("${statName}") then\n` +
           `${'    '.repeat(indentLevel + 2)}table.insert(data, {name = p.Name, score = p.leaderstats.${statName}.Value})\n` +
           `${'    '.repeat(indentLevel + 1)}end\n` +
           `${'    '.repeat(indentLevel)}end\n` +
           `${'    '.repeat(indentLevel)}table.sort(data, function(a, b) return a.score > b.score end)\n` +
           `${'    '.repeat(indentLevel)}-- Export as ${format}\n` +
           `${'    '.repeat(indentLevel)}return data\n` +
           `${'    '.repeat(indentLevel - 1)}end`;
  },
  'math_add': (b) => `${v(b, 'A')} + ${v(b, 'B')}`,
  'math_subtract': (b) => `${v(b, 'A')} - ${v(b, 'B')}`,
  'math_multiply': (b) => `${v(b, 'A')} * ${v(b, 'B')}`,
  'math_divide': (b) => `${v(b, 'A')} / ${v(b, 'B')}`,
  'math_arithmetic': (b) => {
    const opMap = {
      'ADD': '+',
      'MINUS': '-',
      'MULTIPLY': '*',
      'DIVIDE': '/'
    };
    const op = opMap[b.getFieldValue('OP')] || '+';
    const a = v(b, 'A');
    const bVal = v(b, 'B');
    return `${a} ${op} ${bVal}`;
  }
};

function generateCode() {
  const workspace = Blockly.getMainWorkspace();
  generateLua(workspace);
  updateStatusIndicator('Code generated!', 'success');
}

function generateLua(workspace) {
  const blocks = workspace.getTopBlocks(true);
  let code = '';
  const vars = new Set();
  const generatedCode = new Set(); // Track generated code to prevent duplicates
  
  if (blocks.length === 0) {
    code = '-- No blocks found in workspace\n-- Drag blocks from the toolbox to start coding!';
  } else {
    // Group blocks by type for better organization
    const groupedBlocks = {
      variables: [],
      functions: [],
      events: [],
      teamCreation: [], // Separate team creation blocks
      teamAssignment: [], // Separate team assignment blocks
      objects: [],
      logic: [],
      loops: [],
      other: []
    };
    
    blocks.forEach(block => {
      if (block.type.startsWith('variables_')) {
        groupedBlocks.variables.push(block);
      } else if (block.type.startsWith('procedures_')) {
        groupedBlocks.functions.push(block);
      } else if (block.type.startsWith('event_')) {
        groupedBlocks.events.push(block);
      } else if (block.type === 'create_team') {
        groupedBlocks.teamCreation.push(block);
      } else if (block.type === 'set_player_team') {
        groupedBlocks.teamAssignment.push(block);
      } else if (block.type.includes('part') || block.type.includes('player')) {
        groupedBlocks.objects.push(block);
      } else if (block.type.startsWith('controls_') || block.type.startsWith('logic_')) {
        groupedBlocks.logic.push(block);
      } else if (block.type.includes('for') || block.type.includes('while') || block.type.includes('repeat')) {
        groupedBlocks.loops.push(block);
      } else {
        groupedBlocks.other.push(block);
      }
    });
    
    // Generate code in logical order
    const sections = [
      { title: 'Variables', blocks: groupedBlocks.variables },
      { title: 'Functions', blocks: groupedBlocks.functions },
      { title: 'Team Creation', blocks: groupedBlocks.teamCreation },
      { title: 'Object Creation', blocks: groupedBlocks.objects },
      { title: 'Team Assignment', blocks: groupedBlocks.teamAssignment },
      { title: 'Event Handlers', blocks: groupedBlocks.events },
      { title: 'Main Logic', blocks: groupedBlocks.logic },
      { title: 'Loops', blocks: groupedBlocks.loops },
      { title: 'Other', blocks: groupedBlocks.other }
    ];
    
    sections.forEach(section => {
      if (section.blocks.length > 0) {
        section.blocks.forEach(block => {
          // Process the main block
          const fn = LuaGen[block.type];
          if (fn) {
            const blockCode = fn(block, vars, 1);
            if (blockCode.trim()) {
              // Check if this exact code has already been generated
              const normalizedCode = blockCode.trim();
              if (!generatedCode.has(normalizedCode)) {
                generatedCode.add(normalizedCode);
                code += blockCode + '\n';
              }
            }
          }
          
          // Process connected blocks (blocks that are connected via next connection)
          let nextBlock = block.getNextBlock();
          while (nextBlock) {
            const nextFn = LuaGen[nextBlock.type];
            if (nextFn) {
              const nextBlockCode = nextFn(nextBlock, vars, 1);
              if (nextBlockCode.trim()) {
                const normalizedNextCode = nextBlockCode.trim();
                if (!generatedCode.has(normalizedNextCode)) {
                  generatedCode.add(normalizedNextCode);
                  code += nextBlockCode + '\n';
                }
              }
            }
            nextBlock = nextBlock.getNextBlock();
          }
        });
      }
    });
  }
  
  // Clean up the generated code and remove duplicates
  code = deduplicateCode(code);
  
  // Resolve variable name conflicts
  code = resolveVariableConflicts(code);
  
  // Ensure logical flow (team creation before team assignment)
  code = ensureLogicalFlow(code);
  
  // Consolidate service declarations
  code = consolidateServiceDeclarations(code);
  
  // Clean up the generated code
  code = code
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive blank lines
    .replace(/\s+$/gm, '') // Remove trailing whitespace
    .trim();
  
  if (!code.endsWith('\n')) {
    code += '\n';
  }
  
  document.getElementById('codeOutput').textContent = code;
}

// Function to deduplicate code lines
function deduplicateCode(code) {
  const lines = code.split('\n');
  const seenLines = new Set();
  const deduplicatedLines = [];
  const seenPatterns = new Set();
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (trimmedLine === '') {
      if (!seenLines.has(trimmedLine)) {
        seenLines.add(trimmedLine);
        deduplicatedLines.push(line);
      }
      continue;
    }
    
    // Handle comments - allow similar comments but not exact duplicates
    if (trimmedLine.startsWith('--')) {
      if (!seenLines.has(trimmedLine)) {
        seenLines.add(trimmedLine);
        deduplicatedLines.push(line);
      }
      continue;
    }
    
    // For code lines, check for exact duplicates and similar patterns
    if (!seenLines.has(trimmedLine)) {
      // Check for similar patterns (like repeated service declarations)
      const pattern = extractCodePattern(trimmedLine);
      if (!seenPatterns.has(pattern)) {
        seenPatterns.add(pattern);
        seenLines.add(trimmedLine);
        deduplicatedLines.push(line);
      }
    }
  }
  
  return deduplicatedLines.join('\n');
}

// Function to extract code patterns for better deduplication
function extractCodePattern(line) {
  // Remove specific values but keep structure
  let pattern = line
    .replace(/"[^"]*"/g, '"STRING"') // Replace strings
    .replace(/\d+/g, 'NUMBER') // Replace numbers
    .replace(/[A-Za-z_][A-Za-z0-9_]*/g, (match) => {
      // Keep common Lua keywords and functions
      const keywords = ['local', 'if', 'then', 'else', 'end', 'for', 'while', 'do', 'function', 'return', 'and', 'or', 'not', 'true', 'false', 'nil'];
      if (keywords.includes(match)) {
        return match;
      }
      // Keep common Roblox services and properties
      const services = ['game', 'workspace', 'Players', 'Teams', 'UserInputService', 'RunService', 'TweenService'];
      const properties = ['Position', 'Size', 'Color', 'Transparency', 'Anchored', 'CanCollide', 'WalkSpeed', 'JumpPower', 'Health', 'MaxHealth'];
      if (services.includes(match) || properties.includes(match)) {
        return match;
      }
      return 'VARIABLE';
    });
  
  return pattern;
}

// Function to resolve variable name conflicts
function resolveVariableConflicts(code) {
  const lines = code.split('\n');
  const variableMap = new Map();
  let variableCounter = 1;
  
  // First pass: identify all variable declarations and create mapping
  lines.forEach(line => {
    const localMatch = line.match(/local\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
    if (localMatch) {
      const varName = localMatch[1];
      if (variableMap.has(varName)) {
        // Variable name conflict detected, rename it
        const newName = `${varName}_${variableCounter++}`;
        variableMap.set(varName, newName);
      } else {
        variableMap.set(varName, varName);
      }
    }
  });
  
  // Second pass: replace all occurrences of conflicting variables
  return lines.map(line => {
    let modifiedLine = line;
    
    // Replace variable names based on the mapping
    variableMap.forEach((newName, oldName) => {
      if (newName !== oldName) {
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${oldName}\\b`, 'g');
        modifiedLine = modifiedLine.replace(regex, newName);
      }
    });
    
    return modifiedLine;
  }).join('\n');
}

// Function to consolidate service declarations at the top
function consolidateServiceDeclarations(code) {
  const lines = code.split('\n');
  const serviceDeclarations = new Set();
  const otherLines = [];
  
  // Extract service declarations
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.includes('game:GetService(') && !trimmedLine.includes('--')) {
      serviceDeclarations.add(trimmedLine);
    } else {
      otherLines.push(line);
    }
  }
  
  // If we have service declarations, put them at the top
  if (serviceDeclarations.size > 0) {
    const consolidatedCode = Array.from(serviceDeclarations).join('\n') + '\n\n' + otherLines.join('\n');
    return consolidatedCode;
  }
  
  return code;
}

// Function to ensure logical code flow
function ensureLogicalFlow(code) {
  const lines = code.split('\n');
  const reorderedLines = [];
  const teamCreationLines = [];
  const teamAssignmentLines = [];
  const otherLines = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Group lines by type
    if (trimmedLine.includes('Instance.new("Team")')) {
      teamCreationLines.push(line);
    } else if (trimmedLine.includes('FindFirstChild') && trimmedLine.includes('Teams')) {
      teamAssignmentLines.push(line);
    } else {
      otherLines.push(line);
    }
  }
  
  // Reorder: team creation first, then team assignment, then everything else
  const reorderedCode = [...teamCreationLines, ...teamAssignmentLines, ...otherLines].join('\n');
  
  // Add a comment to separate sections if we have both creation and assignment
  if (teamCreationLines.length > 0 && teamAssignmentLines.length > 0) {
    return reorderedCode.replace(
      /(Instance\.new\("Team"\).*?team\.Parent = game:GetService\("Teams"\))/s,
      '$1\n\n-- Team assignments:'
    );
  }
  
  return reorderedCode;
}

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: document.getElementById('toolbox'),
  scrollbars: true,
  trashcan: true,
  theme: Blockly.Themes.Dark
});

// Hide loading indicator after Blockly is loaded
document.getElementById('loadingIndicator').style.display = 'none';



// Smart auto-live code generation with debouncing and intelligent updates
let codeGenerationTimeout = null;
let lastWorkspaceHash = '';
let isGenerating = false;

workspace.addChangeListener((event) => {
  // Update dropdowns immediately for better UX
  if (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.BLOCK_DELETE || event.type === Blockly.Events.BLOCK_CHANGE) {
    updatePartDropdownOptions();
    updateTeamDropdownOptions();
  }
  
  // Enhanced connection line visibility
  if (event.type === Blockly.Events.BLOCK_MOVE || event.type === Blockly.Events.BLOCK_CHANGE) {
    enhanceConnectionLines();
  }
  
  // Smart code generation with debouncing
  scheduleCodeGeneration();
});

// Function to schedule code generation with intelligent debouncing
function scheduleCodeGeneration() {
  if (isGenerating) return;
  
  // Clear existing timeout
  if (codeGenerationTimeout) {
    clearTimeout(codeGenerationTimeout);
  }
  
  // Calculate workspace hash to detect meaningful changes
  const workspace = Blockly.getMainWorkspace();
  const currentHash = calculateWorkspaceHash(workspace);
  
  // Only regenerate if workspace actually changed and it's significant
  if (currentHash !== lastWorkspaceHash && isSignificantChange(lastWorkspaceHash, currentHash)) {
    lastWorkspaceHash = currentHash;
    
    // Show generating indicator
    updateStatusIndicator('Generating code...', 'info');
    
    // Use different debounce times based on change type
    const debounceTime = getDebounceTime(currentHash, lastWorkspaceHash);
    
    // Debounce code generation for better performance
    codeGenerationTimeout = setTimeout(() => {
      if (!isGenerating) {
        isGenerating = true;
        generateLuaOptimized(workspace);
        isGenerating = false;
      }
    }, debounceTime);
  }
}

// Function to determine optimal debounce time based on change type
function getDebounceTime(newHash, oldHash) {
  try {
    const newData = JSON.parse(newHash);
    const oldData = oldHash ? JSON.parse(oldHash) : [];
    
    // If adding/removing blocks, use shorter debounce
    if (Math.abs(newData.length - oldData.length) > 0) {
      return 100; // Fast response for structural changes
    }
    
    // If changing important fields, use medium debounce
    const hasImportantFieldChange = newData.some((block, index) => {
      if (!oldData[index]) return false;
      const importantFields = ['PART_NAME', 'TEAM_NAME', 'TEAM', 'X', 'Y', 'Z', 'SPEED', 'HEALTH'];
      return importantFields.some(field => 
        block.fields[field] !== oldData[index].fields[field]
      );
    });
    
    if (hasImportantFieldChange) {
      return 120; // Medium response for important changes
    }
    
    // Default debounce for other changes
    return 150;
  } catch (error) {
    return 150; // Default fallback
  }
}

// Function to calculate workspace hash for change detection
function calculateWorkspaceHash(workspace) {
  const blocks = workspace.getAllBlocks(false);
  const blockData = blocks.map(block => {
    // Get all field values
    const fields = {};
    if (block.inputList) {
      block.inputList.forEach(input => {
        if (input.fieldRow) {
          input.fieldRow.forEach(field => {
            if (field.name && field.getValue) {
              fields[field.name] = field.getValue();
            }
          });
        }
      });
    }
    
    // Get connections
    const connections = [];
    if (block.getConnections_) {
      block.getConnections_().forEach(conn => {
        if (conn.targetBlock) {
          connections.push({
            type: conn.type,
            targetId: conn.targetBlock.id
          });
        }
      });
    }
    
    return {
      type: block.type,
      id: block.id,
      fields: fields,
      connections: connections,
      position: block.getRelativeToSurfaceXY ? block.getRelativeToSurfaceXY() : null
    };
  });
  
  // Sort by ID for consistent hashing
  blockData.sort((a, b) => a.id.localeCompare(b.id));
  
  return JSON.stringify(blockData);
}

// Function to detect if change is significant enough to regenerate code
function isSignificantChange(oldHash, newHash) {
  try {
    const oldData = JSON.parse(oldHash);
    const newData = JSON.parse(newHash);
    
    // If number of blocks changed, it's significant
    if (oldData.length !== newData.length) {
      return true;
    }
    
    // Check for changes in block types or connections
    for (let i = 0; i < newData.length; i++) {
      if (oldData[i].type !== newData[i].type) {
        return true;
      }
      
      // Check if connections changed
      if (JSON.stringify(oldData[i].connections) !== JSON.stringify(newData[i].connections)) {
        return true;
      }
      
      // Check if important fields changed
      const importantFields = ['PART_NAME', 'TEAM_NAME', 'TEAM', 'X', 'Y', 'Z', 'SPEED', 'HEALTH'];
      for (const field of importantFields) {
        if (oldData[i].fields[field] !== newData[i].fields[field]) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    // If parsing fails, assume it's significant
    return true;
  }
}

// Code generation cache for performance
const codeCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

// Performance monitoring
const performanceStats = {
  totalGenerations: 0,
  averageTime: 0,
  fastestTime: Infinity,
  slowestTime: 0,
  cacheHitRate: 0,
  lastUpdate: Date.now()
};

// Function to update performance statistics
function updatePerformanceStats(generationTime, wasCached = false) {
  performanceStats.totalGenerations++;
  performanceStats.averageTime = (performanceStats.averageTime * (performanceStats.totalGenerations - 1) + generationTime) / performanceStats.totalGenerations;
  performanceStats.fastestTime = Math.min(performanceStats.fastestTime, generationTime);
  performanceStats.slowestTime = Math.max(performanceStats.slowestTime, generationTime);
  performanceStats.cacheHitRate = cacheHits / (cacheHits + cacheMisses);
  performanceStats.lastUpdate = Date.now();
  
  // Log performance metrics every 10 generations
  if (performanceStats.totalGenerations % 10 === 0) {
    console.log('Performance Stats:', {
      totalGenerations: performanceStats.totalGenerations,
      averageTime: performanceStats.averageTime.toFixed(2) + 'ms',
      fastestTime: performanceStats.fastestTime.toFixed(2) + 'ms',
      slowestTime: performanceStats.slowestTime.toFixed(2) + 'ms',
      cacheHitRate: (performanceStats.cacheHitRate * 100).toFixed(1) + '%'
    });
  }
}

// Optimized code generation function
function generateLuaOptimized(workspace) {
  try {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = lastWorkspaceHash;
    if (codeCache.has(cacheKey)) {
      const cachedCode = codeCache.get(cacheKey);
      document.getElementById('codeOutput').textContent = cachedCode;
      cacheHits++;
      
      const endTime = performance.now();
      const generationTime = endTime - startTime;
      updatePerformanceStats(generationTime, true);
      updateStatusIndicator(`Code loaded from cache in ${generationTime.toFixed(1)}ms`, 'success');
      return;
    }
    
    cacheMisses++;
    
    // Generate code using existing logic
    generateLua(workspace);
    
    // Cache the generated code
    const generatedCode = document.getElementById('codeOutput').textContent;
    codeCache.set(cacheKey, generatedCode);
    
    // Limit cache size to prevent memory issues
    if (codeCache.size > 100) {
      const firstKey = codeCache.keys().next().value;
      codeCache.delete(firstKey);
    }
    
    // Detect script type and show warnings
    const { warnings, scriptType } = detectScriptTypeAndWarn(generatedCode);
    if (warnings.length > 0) {
      showScriptTypeWarnings(warnings, scriptType);
    }
    
    const endTime = performance.now();
    const generationTime = endTime - startTime;
    
    // Update performance statistics
    updatePerformanceStats(generationTime, false);
    
    // Update status with performance info
    const cacheRate = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);
    updateStatusIndicator(`Code generated in ${generationTime.toFixed(1)}ms (Cache: ${cacheRate}%)`, 'success');
    
    // Show performance notification for slow generations
    if (generationTime > 100) {
      showNotification(`Code generated in ${generationTime.toFixed(1)}ms`, 'info');
    }
    
    // Auto-optimize debounce time based on performance
    if (performanceStats.totalGenerations % 20 === 0) {
      optimizeDebounceTime();
    }
  } catch (error) {
    console.error('Code generation error:', error);
    updateStatusIndicator('Code generation failed', 'error');
    showNotification('Code generation failed', 'error');
  }
}

// Function to auto-optimize debounce time based on performance
function optimizeDebounceTime() {
  const avgTime = performanceStats.averageTime;
  const cacheRate = performanceStats.cacheHitRate;
  
  // If average time is high and cache hit rate is low, increase debounce
  if (avgTime > 50 && cacheRate < 0.3) {
    console.log('Performance optimization: Increasing debounce time due to slow generation');
  }
  
  // If average time is low and cache hit rate is high, decrease debounce
  if (avgTime < 20 && cacheRate > 0.7) {
    console.log('Performance optimization: Decreasing debounce time due to fast generation');
  }
}

// Function to clear cache and reset performance stats
function clearCodeCache() {
  codeCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
  performanceStats.totalGenerations = 0;
  performanceStats.averageTime = 0;
  performanceStats.fastestTime = Infinity;
  performanceStats.slowestTime = 0;
  performanceStats.cacheHitRate = 0;
  lastWorkspaceHash = '';
  
  console.log('Code cache cleared and performance stats reset');
  showNotification('Code cache cleared', 'info');
}

// Function to get performance statistics
function getPerformanceStats() {
  return {
    ...performanceStats,
    cacheSize: codeCache.size,
    cacheHitRate: (performanceStats.cacheHitRate * 100).toFixed(1) + '%'
  };
}

// Function to enhance connection line visibility
function enhanceConnectionLines() {
  const workspace = Blockly.getMainWorkspace();
  const blocks = workspace.getAllBlocks(false);
  
  blocks.forEach(block => {
    // Add connected class to blocks that have connections
    if (block.previousConnection && block.previousConnection.isConnected() && block.svgPath_) {
      block.svgPath_.classList.add('blocklyConnected');
    } else if (block.svgPath_) {
      block.svgPath_.classList.remove('blocklyConnected');
    }
    
    if (block.nextConnection && block.nextConnection.isConnected() && block.svgPath_) {
      block.svgPath_.classList.add('blocklyConnected');
    }
  });
  
  // Enhance connection lines
  const connectionLines = document.querySelectorAll('.blocklyConnectionLine');
  connectionLines.forEach(line => {
    line.style.stroke = '#667eea';
    line.style.strokeWidth = '3px';
    line.style.strokeLinecap = 'round';
    line.style.strokeLinejoin = 'round';
    line.style.filter = 'drop-shadow(0 0 6px rgba(102, 126, 234, 0.4))';
  });
}

// Function to enhance Blockly styling
function enhanceBlocklyStyling() {
  const workspace = Blockly.getMainWorkspace();
  const blocks = workspace.getAllBlocks(false);
  
  blocks.forEach(block => {
    enhanceBlock(block);
  });
}

// Function to enhance individual blocks
function enhanceBlock(block) {
  if (!block || !block.svgGroup_) return;
  
  try {
    const paths = block.svgGroup_.querySelectorAll('path');
    paths.forEach(path => {
      path.style.stroke = 'rgba(255, 255, 255, 0.15)';
      path.style.strokeWidth = '2px';
      path.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      path.style.filter = 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))';
    });
    
    const texts = block.svgGroup_.querySelectorAll('text, tspan');
    texts.forEach(text => {
      text.style.fill = '#ffffff';
      text.style.fontFamily = 'Inter, sans-serif';
      text.style.fontSize = '14px';
      text.style.fontWeight = '600';
      text.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
    });
  } catch (error) {
    // Silently handle errors to prevent console spam
  }
}

// Initialize enhanced styling
setTimeout(() => {
  enhanceBlocklyStyling();
  enhanceConnectionLines();
  
  // Force apply CSS styles to all existing blocks
  const blocks = workspace.getAllBlocks(false);
  blocks.forEach(block => {
    if (block.svgGroup_) {
      const paths = block.svgGroup_.querySelectorAll('path');
      paths.forEach(path => {
        path.style.stroke = 'rgba(255, 255, 255, 0.15)';
        path.style.strokeWidth = '2px';
        path.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        path.style.filter = 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))';
      });
      
      const texts = block.svgGroup_.querySelectorAll('text, tspan');
      texts.forEach(text => {
        text.style.fill = '#ffffff';
        text.style.fontFamily = 'Inter, sans-serif';
        text.style.fontSize = '14px';
        text.style.fontWeight = '600';
        text.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
      });
    }
  });
}, 2000);

// Add event listeners for new blocks
workspace.addChangeListener((event) => {
  if (event.type === Blockly.Events.BLOCK_CREATE) {
    setTimeout(() => {
      const block = workspace.getBlockById(event.blockId);
      if (block) {
        enhanceBlock(block);
      }
    }, 100);
  }
});

document.getElementById('copyButton').addEventListener('click', () => {
  const code = document.getElementById('codeOutput').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showNotification('Code copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    showNotification('Failed to copy code', 'error');
  });
});

generateLua(workspace);

// Add resize functionality for code output
function initializeCodeResize() {
  const handle = document.querySelector('.code-output-handle');
  const codeSection = document.querySelector('.code-section');
  const workspaceSection = document.querySelector('.workspace-section');
  
  if (!handle || !codeSection || !workspaceSection) return;
  
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = codeSection.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaY = e.clientY - startY;
    const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
    
    codeSection.style.height = `${newHeight}px`;
    workspaceSection.style.height = `calc(100% - ${newHeight + 48}px)`; // 48px for gap and padding
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
    }
  });
}

// Initialize resize functionality after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initializeCodeResize, 100);
  
  // Initialize search functionality
  initializeSearch();
  
  // Load custom blocks
  loadCustomBlocks();
  
  // Initialize enhanced styling
  setTimeout(() => {
    enhanceBlocklyStyling();
    enhanceConnectionLines();
  }, 2000);
});

// Toggle code panel between normal and maximized
function toggleCodePanel() {
  const codeSection = document.querySelector('.code-section');
  const workspaceSection = document.querySelector('.workspace-section');
  const toggleIcon = document.getElementById('toggleIcon');
  const toggleText = document.getElementById('toggleText');
  
  if (!codeSection || !workspaceSection) return;
  
  const isMaximized = codeSection.classList.contains('maximized');
  
  if (isMaximized) {
    // Restore normal size
    codeSection.classList.remove('maximized');
    workspaceSection.classList.remove('minimized');
    codeSection.style.height = '45%';
    workspaceSection.style.height = '';
    toggleIcon.textContent = '📏';
    toggleText.textContent = 'Maximize';
    showNotification('Code panel restored to normal size', 'info');
  } else {
    // Maximize code panel
    codeSection.classList.add('maximized');
    workspaceSection.classList.add('minimized');
    codeSection.style.height = '80%';
    workspaceSection.style.height = '20%';
    toggleIcon.textContent = '📐';
    toggleText.textContent = 'Restore';
    showNotification('Code panel maximized', 'success');
  }
}





// Smart code analysis functions
function analyzeCode() {
  const codeElement = document.getElementById('smartLuaCode');
  if (!codeElement) {
    showNotification('Code input element not found', 'error');
    return;
  }
  
  const code = codeElement.value.trim();
  if (!code) {
    showNotification('Please enter some Lua code to analyze', 'error');
    return;
  }
  
  const analyzeBtn = document.querySelector('.analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.classList.add('analyzing');
    analyzeBtn.innerHTML = '<span class="button-icon">⏳</span>Analyzing...';
  }
  
  // Simulate analysis delay for better UX
  setTimeout(() => {
    const analysis = performSmartAnalysis(code);
    displayAnalysisResults(analysis);
    if (analyzeBtn) {
      analyzeBtn.classList.remove('analyzing');
      analyzeBtn.innerHTML = '<span class="button-icon">🔍</span>Analyze Code';
    }
  }, 1000);
}

function performSmartAnalysis(code) {
  const analysis = {
    category: 'Custom',
    type: 'statement',
    displayText: '',
    color: '#667eea',
    inputs: [],
    processedCode: code
  };
  
  // Convert code to lowercase for easier analysis
  const lowerCode = code.toLowerCase();
  
  // Analyze for category
  if (lowerCode.includes('player') || lowerCode.includes('humanoid') || lowerCode.includes('character')) {
    analysis.category = 'Player';
    analysis.color = '#50fa7b';
  } else if (lowerCode.includes('part') || lowerCode.includes('workspace') || lowerCode.includes('instance.new')) {
    analysis.category = 'Environment';
    analysis.color = '#8be9fd';
  } else if (lowerCode.includes('event') || lowerCode.includes('connect') || lowerCode.includes('wait')) {
    analysis.category = 'Events';
    analysis.color = '#ff79c6';
  } else if (lowerCode.includes('if') || lowerCode.includes('else') || lowerCode.includes('and') || lowerCode.includes('or')) {
    analysis.category = 'Logic';
    analysis.color = '#f1fa8c';
  } else if (lowerCode.includes('for') || lowerCode.includes('while') || lowerCode.includes('repeat')) {
    analysis.category = 'Loops';
    analysis.color = '#bd93f9';
  } else if (lowerCode.includes('function') || lowerCode.includes('return')) {
    analysis.category = 'Functions';
    analysis.color = '#ffb86c';
  } else if (lowerCode.includes('math.') || lowerCode.includes('+') || lowerCode.includes('-') || lowerCode.includes('*') || lowerCode.includes('/')) {
    analysis.category = 'Math';
    analysis.color = '#ff5555';
  } else if (lowerCode.includes('print') || lowerCode.includes('string') || lowerCode.includes('"') || lowerCode.includes("'")) {
    analysis.category = 'Text';
    analysis.color = '#6272a4';
  } else if (lowerCode.includes('table') || lowerCode.includes('{}') || lowerCode.includes('[')) {
    analysis.category = 'Tables';
    analysis.color = '#50fa7b';
  } else if (lowerCode.includes('remote') || lowerCode.includes('fire') || lowerCode.includes('replicated')) {
    analysis.category = 'Remote Events';
    analysis.color = '#ff79c6';
  }
  
  // Analyze for block type
  if (lowerCode.includes('return') || lowerCode.includes('=') && !lowerCode.includes('local') && !lowerCode.includes('if')) {
    analysis.type = 'value';
  }
  
  // Detect potential inputs
  const inputPatterns = [
    // Numbers
    { pattern: /\b\d+(?:\.\d+)?\b/g, type: 'field_number', name: 'number' },
    // Strings
    { pattern: /["']([^"']+)["']/g, type: 'field_input', name: 'text' },
    // Variables that could be inputs
    { pattern: /\b(local\s+)?(\w+)\s*=\s*([^;]+)/g, type: 'input_value', name: 'variable' },
    // Function parameters
    { pattern: /function\s*\w*\s*\(([^)]*)\)/g, type: 'input_value', name: 'parameter' }
  ];
  
  const detectedInputs = new Set();
  
  inputPatterns.forEach(pattern => {
    const matches = code.match(pattern.pattern);
    if (matches) {
      matches.forEach((match, index) => {
        if (index < 3) { // Limit to first 3 inputs
          const inputName = generateInputName(pattern.name, index + 1);
          if (!detectedInputs.has(inputName)) {
            detectedInputs.add(inputName);
            analysis.inputs.push({
              name: inputName,
              type: pattern.type,
              originalValue: match
            });
          }
        }
      });
    }
  });
  
  // Generate display text
  analysis.displayText = generateDisplayText(code, analysis.inputs);
  
  // Process code for placeholders
  analysis.processedCode = processCodeWithPlaceholders(code, analysis.inputs);
  
  return analysis;
}

function generateInputName(baseName, index) {
  const names = {
    'number': ['value', 'amount', 'count'],
    'text': ['message', 'text', 'name'],
    'variable': ['input', 'value', 'data'],
    'parameter': ['param', 'value', 'input']
  };
  
  const nameList = names[baseName] || ['input'];
  return nameList[index - 1] || `${baseName}${index}`;
}

function generateDisplayText(code, inputs) {
  let displayText = code.split('\n')[0].trim();
  
  // Clean up the display text
  displayText = displayText
    .replace(/^local\s+/, '')
    .replace(/^function\s+/, '')
    .replace(/\s*=\s*.*$/, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .replace(/["']([^"']+)["']/, '%1')
    .replace(/\b\d+(?:\.\d+)?\b/, '%1')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Add input placeholders
  inputs.forEach((input, index) => {
    const placeholder = `%${index + 1}`;
    if (!displayText.includes(placeholder)) {
      displayText = displayText.replace(/\b\w+\b/, `${displayText} ${placeholder}`);
    }
  });
  
  // Fallback if no good text found
  if (!displayText || displayText.length < 3) {
    displayText = `Custom block ${inputs.length > 0 ? '%1' : ''}`;
  }
  
  return displayText;
}

function processCodeWithPlaceholders(code, inputs) {
  let processedCode = code;
  
  inputs.forEach((input, index) => {
    const placeholder = `{${input.name.toUpperCase()}}`;
    
    switch (input.type) {
      case 'field_number':
        // Replace numbers with placeholders
        processedCode = processedCode.replace(/\b\d+(?:\.\d+)?\b/, placeholder);
        break;
      case 'field_input':
        // Replace strings with placeholders
        processedCode = processedCode.replace(/["']([^"']+)["']/, placeholder);
        break;
      case 'input_value':
        // Replace variable assignments with placeholders
        processedCode = processedCode.replace(/\b(\w+)\s*=\s*([^;]+)/, `$1 = ${placeholder}`);
        break;
    }
  });
  
  return processedCode;
}

function displayAnalysisResults(analysis) {
  // Update analysis results with null checks
  const suggestedCategory = document.getElementById('suggestedCategory');
  const suggestedType = document.getElementById('suggestedType');
  const suggestedText = document.getElementById('suggestedText');
  const suggestedColor = document.getElementById('suggestedColor');
  
  if (suggestedCategory) suggestedCategory.textContent = analysis.category;
  if (suggestedType) suggestedType.textContent = analysis.type === 'statement' ? 'Statement (No output)' : 'Value (With output)';
  if (suggestedText) suggestedText.textContent = analysis.displayText;
  if (suggestedColor) suggestedColor.innerHTML = `<span style="color: ${analysis.color}">${analysis.color}</span>`;
  
  // Update advanced options
  const blockColor = document.getElementById('blockColor');
  const blockCategory = document.getElementById('blockCategory');
  const blockType = document.getElementById('blockType');
  
  if (blockColor) blockColor.value = analysis.color;
  if (blockCategory) blockCategory.value = analysis.category;
  if (blockType) blockType.value = analysis.type;
  
  // Display detected inputs
  const inputsContainer = document.getElementById('detectedInputsList');
  if (inputsContainer) {
    inputsContainer.innerHTML = '';
    
    if (analysis.inputs.length === 0) {
      inputsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center; padding: 10px;">No inputs detected</p>';
    } else {
      analysis.inputs.forEach((input, index) => {
        const inputItem = document.createElement('div');
        inputItem.className = 'detected-input-item';
        inputItem.innerHTML = `
          <div class="detected-input-info">
            <div class="detected-input-name">${input.name}</div>
            <div class="detected-input-type">${input.type.replace('_', ' ')}</div>
          </div>
          <div class="detected-input-suggestion">Input ${index + 1}</div>
        `;
        inputsContainer.appendChild(inputItem);
      });
    }
  }
  
  // Display code preview
  const codePreview = document.getElementById('codePreview');
  if (codePreview) codePreview.textContent = analysis.processedCode;
  
  // Show results
  const analysisResults = document.getElementById('analysisResults');
  if (analysisResults) analysisResults.style.display = 'block';
  
  // Auto-generate block name if empty
  const blockNameInput = document.getElementById('blockName');
  if (blockNameInput && !blockNameInput.value.trim()) {
    const suggestedName = generateBlockName(analysis.displayText, analysis.category);
    blockNameInput.value = suggestedName;
  }
}

function generateBlockName(displayText, category) {
  let name = displayText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  if (!name) {
    name = 'custom_block';
  }
  
  // Add category prefix if not custom
  if (category !== 'Custom') {
    name = `${category.toLowerCase().replace(/\s+/g, '_')}_${name}`;
  }
  
  return name;
}

function toggleAdvancedOptions() {
  const advancedOptions = document.querySelector('.advanced-options');
  const toggleBtn = document.querySelector('.modal-button');
  
  if (!advancedOptions || !toggleBtn) return;
  
  if (advancedOptions.style.display === 'none') {
    advancedOptions.style.display = 'block';
    toggleBtn.textContent = 'Hide Advanced Options';
  } else {
    advancedOptions.style.display = 'none';
    toggleBtn.textContent = 'Advanced Options';
  }
}

function createSmartCustomBlock() {
  const blockName = document.getElementById('blockName').value.trim();
  const luaCode = document.getElementById('smartLuaCode').value.trim();
  
  if (!luaCode) {
    showNotification('Please enter some Lua code', 'error');
    return;
  }
  
  // Perform analysis if not already done
  const analysis = performSmartAnalysis(luaCode);
  
  // Use advanced options if available
  const advancedOptions = document.querySelector('.advanced-options');
  if (advancedOptions && advancedOptions.style.display !== 'none') {
    analysis.color = document.getElementById('blockColor').value;
    analysis.category = document.getElementById('blockCategory').value;
    analysis.type = document.getElementById('blockType').value;
  } else {
    // Force custom blocks to go to Custom category
    analysis.category = 'Custom';
  }
  
  // Create the custom block
  const customBlock = {
    name: blockName || generateBlockName(analysis.displayText, analysis.category),
    text: analysis.displayText,
    color: analysis.color,
    category: analysis.category,
    type: analysis.type,
    luaCode: analysis.processedCode,
    inputFields: analysis.inputs,
    created: new Date().toISOString()
  };
  
  // Validate block name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(customBlock.name)) {
    showNotification('Invalid block name. Must start with a letter or underscore and contain only letters, numbers, and underscores.', 'error');
    return;
  }
  
  // Check if block name already exists
  if (customBlocks.some(block => block.name === customBlock.name)) {
    showNotification('A block with this name already exists', 'error');
    return;
  }
  
  customBlocks.push(customBlock);
  saveCustomBlocks();
  registerCustomBlock(customBlock);
  addCustomBlockToToolbox(customBlock);
  
  closeCustomBlockModal();
  showNotification('Smart custom block created successfully!', 'success');
  updateStatusIndicator('Smart block added', 'success');
}

// Function to close custom block modal
function closeCustomBlockModal() {
  const modal = document.getElementById('customBlockModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Function to open custom block modal
function openCustomBlockModal() {
  const modal = document.getElementById('customBlockModal');
  if (modal) {
    modal.classList.add('show');
  }
}

// Update the clear form function for the new interface
function clearCustomBlockForm() {
  const blockName = document.getElementById('blockName');
  const smartLuaCode = document.getElementById('smartLuaCode');
  const blockColor = document.getElementById('blockColor');
  const blockCategory = document.getElementById('blockCategory');
  const blockType = document.getElementById('blockType');
  const analysisResults = document.getElementById('analysisResults');
  const advancedOptions = document.querySelector('.advanced-options');
  const modalButton = document.querySelector('.modal-button');
  
  if (blockName) blockName.value = '';
  if (smartLuaCode) smartLuaCode.value = '';
  if (blockColor) blockColor.value = '#667eea';
  if (blockCategory) blockCategory.value = 'Custom';
  if (blockType) blockType.value = 'statement';
  
  // Hide analysis results
  if (analysisResults) analysisResults.style.display = 'none';
  
  // Hide advanced options
  if (advancedOptions) advancedOptions.style.display = 'none';
  if (modalButton) modalButton.textContent = 'Advanced Options';
}

// Smart Script Helper Features

// Global variables for smart features
let workspaceHistory = [];
let currentHistoryIndex = -1;

let selectedHistoryItem = null;



// Initialize smart features
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners for new buttons
  const undoButton = document.getElementById('undoButton');
  if (undoButton) {
    undoButton.addEventListener('click', showUndoHistoryModal);
  }
  
  // Initialize workspace history
  saveWorkspaceState();
});













// Undo History Functions
function showUndoHistoryModal() {
  document.getElementById('undoHistoryModal').classList.add('show');
  populateHistoryList();
}

function closeUndoHistoryModal() {
  document.getElementById('undoHistoryModal').classList.remove('show');
  selectedHistoryItem = null;
}

function saveWorkspaceState() {
  const workspace = Blockly.getMainWorkspace();
  const xml = Blockly.Xml.workspaceToDom(workspace);
  const xmlText = Blockly.Xml.domToText(xml);
  
  const state = {
    xml: xmlText,
    timestamp: new Date().toISOString(),
    description: `Workspace state saved at ${new Date().toLocaleTimeString()}`,
    blockCount: workspace.getAllBlocks(false).length
  };
  
  // Remove states after current index if we're not at the end
  if (currentHistoryIndex < workspaceHistory.length - 1) {
    workspaceHistory = workspaceHistory.slice(0, currentHistoryIndex + 1);
  }
  
  workspaceHistory.push(state);
  currentHistoryIndex = workspaceHistory.length - 1;
  
  // Keep only last 20 states
  if (workspaceHistory.length > 20) {
    workspaceHistory = workspaceHistory.slice(-20);
    currentHistoryIndex = workspaceHistory.length - 1;
  }
}

function populateHistoryList() {
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '';
  
  workspaceHistory.forEach((state, index) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    if (index === currentHistoryIndex) {
      historyItem.classList.add('selected');
    }
    historyItem.onclick = () => selectHistoryItem(index);
    
    const time = new Date(state.timestamp).toLocaleTimeString();
    
    historyItem.innerHTML = `
      <div class="history-icon">📝</div>
      <div class="history-content">
        <div class="history-title">${state.description}</div>
        <div class="history-time">${time}</div>
        <div class="history-description">${state.blockCount} blocks</div>
      </div>
    `;
    
    historyList.appendChild(historyItem);
  });
}

function selectHistoryItem(index) {
  // Remove previous selection
  document.querySelectorAll('.history-item').forEach(item => item.classList.remove('selected'));
  
  // Select new item
  event.target.closest('.history-item').classList.add('selected');
  selectedHistoryItem = index;
}

function restoreToSelectedHistory() {
  if (selectedHistoryItem === null) {
    showNotification('Please select a history item first', 'warning');
    return;
  }
  
  const state = workspaceHistory[selectedHistoryItem];
  const workspace = Blockly.getMainWorkspace();
  
  workspace.clear();
  const xml = Blockly.Xml.textToDom(state.xml);
  Blockly.Xml.domToWorkspace(xml, workspace);
  
  currentHistoryIndex = selectedHistoryItem;
  generateLua(workspace);
  closeUndoHistoryModal();
  showNotification('Workspace restored successfully!', 'success');
}



// Save workspace state on changes
workspace.addChangeListener((event) => {
  if (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.BLOCK_DELETE || event.type === Blockly.Events.BLOCK_CHANGE) {
    // Delay saving to avoid too many saves
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
      saveWorkspaceState();
    }, 1000);
  }
});

// Continuous styling application
function applyContinuousStyling() {
  try {
    const workspace = Blockly.getMainWorkspace();
    if (!workspace) return;
    
    const blocks = workspace.getAllBlocks(false);
    blocks.forEach(enhanceBlock);
  } catch (error) {
    // Silently handle errors to prevent console spam
  }
}

// Run continuous styling every 2 seconds
setInterval(applyContinuousStyling, 2000);




// ... existing code ...




// Test function to manually show the warning panel
function testWarningPanel() {
  const testWarnings = [
    {
      type: 'server',
      message: 'This is a test server-side warning',
      severity: 'warning',
      suggestion: 'This code should be placed in ServerScriptService'
    },
    {
      type: 'client',
      message: 'This is a test client-side warning',
      severity: 'info',
      suggestion: 'This code should be placed in StarterPlayerScripts'
    }
  ];
  
  const testScriptType = {
    isServer: true,
    isClient: false,
    confidence: 5
  };
  
  showScriptTypeWarnings(testWarnings, testScriptType);
}

// Function to close script type warnings
function closeScriptTypeWarnings() {
  const warningPanel = document.getElementById('scriptTypeWarningPanel');
  if (warningPanel) {
    warningPanel.classList.remove('show');
  }
}

// Function to show script type warnings
function showScriptTypeWarnings(warnings, scriptType) {
  const warningPanel = document.getElementById('scriptTypeWarningPanel');
  if (!warningPanel) return;
  
  const warningsList = warningPanel.querySelector('.warnings-list');
  if (warningsList) {
    warningsList.innerHTML = warnings.map(warning => `
      <div class="warning-item ${warning.severity}">
        <div class="warning-icon">${warning.severity === 'error' ? '❌' : warning.severity === 'warning' ? '⚠️' : 'ℹ️'}</div>
        <div class="warning-content">
          <div class="warning-message">${warning.message}</div>
          <div class="warning-suggestion">${warning.suggestion}</div>
        </div>
      </div>
    `).join('');
  }
  
  warningPanel.classList.add('show');
}

// Function to detect script type and warn
function detectScriptTypeAndWarn(code) {
  const warnings = [];
  let scriptType = { isServer: false, isClient: false, confidence: 0 };
  
  // Simple detection logic
  if (code.includes('game.Players.LocalPlayer')) {
    scriptType.isClient = true;
    scriptType.confidence += 3;
  }
  
  if (code.includes('FireServer') || code.includes('OnServerEvent')) {
    scriptType.isServer = true;
    scriptType.confidence += 2;
  }
  
  // Add warnings based on detection
  if (scriptType.isClient && code.includes('FireServer')) {
    warnings.push({
      type: 'client',
      message: 'Client script trying to fire server events',
      severity: 'warning',
      suggestion: 'Use RemoteEvents for client-server communication'
    });
  }
  
  return { warnings, scriptType };
}

// Add this to the global scope so you can test it
window.testWarningPanel = testWarningPanel;
window.closeScriptTypeWarnings = closeScriptTypeWarnings;

// Search functionality
let searchTimeout;
let allBlocks = [];

// Initialize search functionality
function initializeSearch() {
  const searchInput = document.getElementById('searchInput');
  
  if (!searchInput) return; // Guard against missing element
  
  // Add event listeners
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('keydown', handleSearchKeydown);
  
  // Populate all blocks data
  populateAllBlocks();
}

// Handle search input
function handleSearchInput(event) {
  const query = event.target.value.trim();
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  if (query.length === 0) {
    hideSearchResults();
    return;
  }
  
  // Debounce search
  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 300);
}

// Handle search keydown
function handleSearchKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    performSearch();
  } else if (event.key === 'Escape') {
    hideSearchResults();
    event.target.blur();
  }
}

// Perform search
function performSearch(query = null) {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  
  if (!searchInput || !searchResults) return;
  
  if (!query) {
    query = searchInput.value.trim();
  }
  
  if (query.length === 0) {
    hideSearchResults();
    return;
  }
  
  const results = searchBlocks(query);
  displaySearchResults(results);
}

// Search blocks
function searchBlocks(query) {
  const lowerQuery = query.toLowerCase();
  const results = [];
  
  if (!allBlocks || allBlocks.length === 0) {
    populateAllBlocks(); // Ensure blocks are populated
  }
  
  allBlocks.forEach(block => {
    const score = calculateSearchScore(block, lowerQuery);
    if (score > 0) {
      results.push({ ...block, score });
    }
  });
  
  // Sort by relevance score
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, 10); // Limit to 10 results
}

// Calculate search score
function calculateSearchScore(block, query) {
  let score = 0;
  
  // Exact matches get highest score
  if (block.title.toLowerCase().includes(query)) {
    score += 100;
  }
  if (block.category.toLowerCase().includes(query)) {
    score += 50;
  }
  if (block.description.toLowerCase().includes(query)) {
    score += 30;
  }
  
  // Partial matches
  const words = query.split(' ');
  words.forEach(word => {
    if (block.title.toLowerCase().includes(word)) {
      score += 20;
    }
    if (block.category.toLowerCase().includes(word)) {
      score += 10;
    }
    if (block.description.toLowerCase().includes(word)) {
      score += 5;
    }
  });
  
  return score;
}

// Display search results
function displaySearchResults(results) {
  const searchResults = document.getElementById('searchResults');
  
  if (!searchResults) return;
  
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="no-search-results">No blocks found matching your search.</div>';
  } else {
    searchResults.innerHTML = results.map(block => `
      <div class="search-result-item" onclick="addBlockToWorkspace('${block.type}')">
        <div class="search-result-icon">${block.icon}</div>
        <div class="search-result-content">
          <div class="search-result-title">${block.title}</div>
          <div class="search-result-category">${block.category}</div>
          <div class="search-result-description">${block.description}</div>
        </div>
      </div>
    `).join('');
  }
  
  searchResults.classList.add('show');
}

// Hide search results
function hideSearchResults() {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.classList.remove('show');
  }
}

// Add block to workspace
function addBlockToWorkspace(blockType) {
  try {
    const workspace = Blockly.getMainWorkspace();
    if (!workspace) {
      showNotification('Workspace not available', 'error');
      return;
    }
    
    const block = workspace.newBlock(blockType);
    block.initSvg();
    block.render();
    
    // Position the block in the center of the workspace
    const metrics = workspace.getMetrics();
    const x = metrics.viewWidth / 2;
    const y = metrics.viewHeight / 2;
    block.moveBy(x, y);
    
    // Clear search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
    }
    hideSearchResults();
    
    // Generate code
    generateCode();
    
    showNotification(`Added ${blockType} block to workspace!`, 'success');
  } catch (error) {
    showNotification(`Failed to add block: ${error.message}`, 'error');
  }
}

// Custom blocks storage
let customBlocks = [];

// Load custom blocks from localStorage
function loadCustomBlocks() {
  try {
    const saved = localStorage.getItem('customBlocks');
    if (saved) {
      customBlocks = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load custom blocks:', error);
    customBlocks = [];
  }
}

// Save custom blocks to localStorage
function saveCustomBlocks() {
  try {
    localStorage.setItem('customBlocks', JSON.stringify(customBlocks));
  } catch (error) {
    console.error('Failed to save custom blocks:', error);
  }
}

// Register a custom block
function registerCustomBlock(customBlock) {
  // This would register the block with Blockly
  // For now, we'll just store it
  console.log('Custom block registered:', customBlock.name);
}

// Add custom block to toolbox
function addCustomBlockToToolbox(customBlock) {
  // This would add the block to the toolbox
  // For now, we'll just log it
  console.log('Custom block added to toolbox:', customBlock.name);
}

// Populate all blocks data
function populateAllBlocks() {
  allBlocks = [
    // Environment blocks
    {
      type: 'spawn_part',
      title: 'Spawn Part',
      category: 'Environment',
      description: 'Create a new part in the workspace',
      icon: '🧱'
    },
    {
      type: 'rotate_part',
      title: 'Rotate Part',
      category: 'Environment',
      description: 'Rotate a part by specified angles',
      icon: '🔄'
    },
    {
      type: 'set_part_position',
      title: 'Set Part Position',
      category: 'Environment',
      description: 'Move a part to a specific position',
      icon: '📍'
    },
    {
      type: 'set_part_color',
      title: 'Set Part Color',
      category: 'Environment',
      description: 'Change the color of a part',
      icon: '🎨'
    },
    {
      type: 'create_tween',
      title: 'Create Tween',
      category: 'Environment',
      description: 'Create smooth animations for parts',
      icon: '🎬'
    },
    
    // Events blocks
    {
      type: 'event_touched',
      title: 'Part Touched',
      category: 'Events',
      description: 'Trigger when a part is touched',
      icon: '👆'
    },
    {
      type: 'event_clickdetector',
      title: 'Part Clicked',
      category: 'Events',
      description: 'Trigger when a part is clicked',
      icon: '🖱️'
    },
    {
      type: 'event_player_added',
      title: 'Player Added',
      category: 'Events',
      description: 'Trigger when a player joins',
      icon: '👤'
    },
    {
      type: 'event_key_pressed',
      title: 'Key Pressed',
      category: 'Events',
      description: 'Trigger when a key is pressed',
      icon: '⌨️'
    },
    
    // Logic blocks
    {
      type: 'controls_if',
      title: 'If Statement',
      category: 'Logic',
      description: 'Execute code conditionally',
      icon: '❓'
    },
    {
      type: 'logic_compare',
      title: 'Compare Values',
      category: 'Logic',
      description: 'Compare two values',
      icon: '⚖️'
    },
    {
      type: 'logic_and',
      title: 'AND Logic',
      category: 'Logic',
      description: 'Combine conditions with AND',
      icon: '🔗'
    },
    {
      type: 'logic_or',
      title: 'OR Logic',
      category: 'Logic',
      description: 'Combine conditions with OR',
      icon: '🔗'
    },
    
    // Control blocks
    {
      type: 'wait',
      title: 'Wait',
      category: 'Control',
      description: 'Pause execution for a specified time',
      icon: '⏱️'
    },
    
    // Loop blocks
    {
      type: 'controls_repeat_ext',
      title: 'Repeat',
      category: 'Loops',
      description: 'Repeat code a specified number of times',
      icon: '🔄'
    },
    {
      type: 'controls_whileUntil',
      title: 'While Loop',
      category: 'Loops',
      description: 'Repeat code while a condition is true',
      icon: '🔄'
    },
    {
      type: 'controls_for',
      title: 'For Loop',
      category: 'Loops',
      description: 'Loop through a range of values',
      icon: '🔄'
    },
    
    // Math blocks
    {
      type: 'math_number',
      title: 'Number',
      category: 'Math',
      description: 'A numeric value',
      icon: '🔢'
    },
    {
      type: 'math_arithmetic',
      title: 'Math Operation',
      category: 'Math',
      description: 'Perform mathematical operations',
      icon: '🧮'
    },
    {
      type: 'math_random_range',
      title: 'Random Number',
      category: 'Math',
      description: 'Generate a random number',
      icon: '🎲'
    },
    
    // Text blocks
    {
      type: 'text_input',
      title: 'Text Input',
      category: 'Text',
      description: 'A text string',
      icon: '📝'
    },
    {
      type: 'print_statement',
      title: 'Print',
      category: 'Text',
      description: 'Print text to output',
      icon: '🖨️'
    },
    
    // Player blocks
    {
      type: 'get_player',
      title: 'Get Player',
      category: 'Player',
      description: 'Get the local player',
      icon: '👤'
    },
    {
      type: 'set_player_walkspeed',
      title: 'Set Walk Speed',
      category: 'Player',
      description: 'Change player walking speed',
      icon: '🏃'
    },
    {
      type: 'set_player_health',
      title: 'Set Health',
      category: 'Player',
      description: 'Set player health',
      icon: '❤️'
    },
    {
      type: 'teleport_player',
      title: 'Teleport Player',
      category: 'Player',
      description: 'Move player to a location',
      icon: '🚀'
    },
    
    // Table blocks
    {
      type: 'create_table',
      title: 'Create Table',
      category: 'Tables',
      description: 'Create a new table',
      icon: '📋'
    },
    {
      type: 'get_table_value',
      title: 'Get Table Value',
      category: 'Tables',
      description: 'Get a value from a table',
      icon: '📖'
    },
    
    // Remote Events blocks
    {
      type: 'fire_remote_event',
      title: 'Fire Remote Event',
      category: 'Remote Events',
      description: 'Send data to server',
      icon: '📡'
    },
    {
      type: 'on_remote_event_received',
      title: 'On Remote Event',
      category: 'Remote Events',
      description: 'Handle incoming remote events',
      icon: '📡'
    },
    
    // Leaderboard blocks
    {
      type: 'create_leaderboard',
      title: 'Create Leaderboard',
      category: 'Leaderboards',
      description: 'Create a new leaderboard',
      icon: '🏆'
    },
    {
      type: 'set_leaderboard_value',
      title: 'Set Leaderboard Value',
      category: 'Leaderboards',
      description: 'Set a player\'s score',
      icon: '📊'
    },
    {
      type: 'get_leaderboard_value',
      title: 'Get Leaderboard Value',
      category: 'Leaderboards',
      description: 'Get a player\'s score',
      icon: '📊'
    }
  ];
}

// --- Site State Logic ---
const siteLockoutDiv = document.getElementById('site-lockout');
const appContainer = document.querySelector('.container');
const copyrightFooter = document.querySelector('.copyright-footer');
const statusIndicator = document.querySelector('.status-indicator');
const statusRefreshBtn = document.getElementById('statusRefreshBtn');

let siteStatus = 'Ready';
let siteOwner = 'zanxv213';
let siteStatusDescriptions = {
  Ready: 'The site is fully operational. All features are available.',
  Maintenance: 'The site is under maintenance. Features are temporarily unavailable.',
  Suspended: 'The site is suspended. No actions can be performed at this time.',
  Degraded: 'The site is experiencing issues. Some features may not work as expected.',
  Updating: 'The site is being updated. You may experience brief interruptions.',
  Beta: 'The site is in beta. Features may change or break unexpectedly.'
};
let lastStatusChecked = null;

const statusColors = {
  Ready: '#27c93f',
  Maintenance: '#ffbd2e',
  Suspended: '#ff5f57',
  Degraded: '#ff9800',
  Updating: '#2196f3',
  Beta: '#9c27b0',
  Unknown: '#bdbdbd'
};

const statusIcons = {
  Ready: '🟢',
  Maintenance: '🛠️',
  Suspended: '🔒',
  Degraded: '🟠',
  Updating: '🔵',
  Beta: '🧪',
  Unknown: '❔'
};
const statusBadgeStyles = {
  Maintenance: { bg: '#2e2a1e', color: '#ffbd2e', glow: '#ffbd2e88' },
  Suspended:   { bg: '#2e1e1e', color: '#ff5f57', glow: '#ff5f5788' },
  Degraded:    { bg: '#2e261e', color: '#ff9800', glow: '#ff980088' },
  Updating:    { bg: '#1e2632', color: '#2196f3', glow: '#2196f388' },
  Beta:        { bg: '#241e2e', color: '#9c27b0', glow: '#9c27b088' },
  Unknown:     { bg: '#222', color: '#bdbdbd', glow: '#bdbdbd88' }
};

function updateSidebarStatus() {
  if (!statusIndicator) return;
  // Only update .status-text and .status-dot
  const icon = statusIcons[siteStatus] || statusIcons.Unknown;
  statusIndicator.querySelector('.status-text').textContent = siteStatus;
  // Update dot color
  const dot = statusIndicator.querySelector('.status-dot');
  if (dot) dot.style.background = statusColors[siteStatus] || statusColors.Unknown;
  // Update description
  let desc = statusIndicator.querySelector('.status-description');
  if (!desc) {
    desc = document.createElement('div');
    desc.className = 'status-description';
    statusIndicator.appendChild(desc);
  }
  desc.textContent = siteStatusDescriptions[siteStatus] || '';
  // Update last updated date
  if (statusLastUpdated && lastStatusChecked) {
    const date = lastStatusChecked;
    const formatted = `(${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()})`;
    statusLastUpdated.textContent = `Last updated: ${formatted}`;
    statusLastUpdated.style.display = 'block';
  } else if (statusLastUpdated) {
    statusLastUpdated.style.display = 'none';
  }
}

if (statusRefreshBtn) {
  statusRefreshBtn.addEventListener('click', () => {
    fetchSiteStatusAndUpdate(true);
    // Animate icon
    const icon = statusRefreshBtn.querySelector('.status-refresh-icon');
    if (icon) {
      icon.style.animation = 'statusRefreshSpin 0.7s linear';
      setTimeout(() => { icon.style.animation = ''; }, 700);
    }
  });
}

async function fetchSiteStatusAndUpdate(force = false) {
  try {
    const res = await fetch('status.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Status fetch failed');
    const data = await res.json();
    siteStatus = data.status;
    siteOwner = data.owner || 'the site owner';
    if (data.descriptions) siteStatusDescriptions = data.descriptions;
    lastStatusChecked = new Date(); // Always update lastStatusChecked
    updateSidebarStatus();
    if (siteStatus === 'Maintenance' || siteStatus === 'Suspended') {
      showLockoutPanel(siteStatus, siteOwner, siteStatusDescriptions[siteStatus]);
    } else {
      hideLockoutPanel();
    }
  } catch (e) {
    lastStatusChecked = new Date(); // Also update on error
    siteStatus = 'Unknown';
    updateSidebarStatus();
    showLockoutPanel('Unknown', '', 'Could not check site status. Please try again later.');
  }
}

// Block actions if not Ready
function blockIfNotReady() {
  return siteStatus === 'Maintenance' || siteStatus === 'Suspended';
}

// Patch all main actions to check status
const origGenerateCode = window.generateCode;
window.generateCode = function() { if (!blockIfNotReady()) origGenerateCode.apply(this, arguments); };
const origSaveWorkspace = window.saveWorkspace;
window.saveWorkspace = function() { if (!blockIfNotReady()) origSaveWorkspace.apply(this, arguments); };
const origLoadWorkspace = window.loadWorkspace;
window.loadWorkspace = function() { if (!blockIfNotReady()) origLoadWorkspace.apply(this, arguments); };
const origClearWorkspace = window.clearWorkspace;
window.clearWorkspace = function() { if (!blockIfNotReady()) origClearWorkspace.apply(this, arguments); };
const origOrganizeWorkspace = window.organizeWorkspace;
window.organizeWorkspace = function() { if (!blockIfNotReady()) origOrganizeWorkspace.apply(this, arguments); };
const origFormatCode = window.formatCode;
window.formatCode = function() { if (!blockIfNotReady()) origFormatCode.apply(this, arguments); };

// On load, fetch status and poll every 60s
window.addEventListener('DOMContentLoaded', () => {
  fetchSiteStatusAndUpdate();
  setInterval(fetchSiteStatusAndUpdate, 60000);
});

function showLockoutPanel(status, owner, description) {
  if (appContainer) appContainer.style.display = 'none';
  if (copyrightFooter) copyrightFooter.style.display = 'none';
  if (siteLockoutDiv) {
    siteLockoutDiv.className = 'site-lockout';
    siteLockoutDiv.style.display = 'flex';
    let icon = status === 'Maintenance' ? '<span class="animated-wrench">🔧</span>' : status === 'Suspended' ? '🔒' : '❌';
    let title = status === 'Maintenance' ? `<span class="gradient-title">We\'re Improving Things</span>` : status === 'Suspended' ? '<span class="gradient-title">Site Access Restricted</span>' : '<span class="gradient-title">Site Unavailable</span>';
    let apology = owner ? `<div class=\"signature-apology\"><span>We apologize for the inconvenience.</span><hr><span class=\"signature-owner\">— ${owner}</span></div>` : '<div class=\"signature-apology\"><span>We apologize for the inconvenience.</span></div>';
    siteLockoutDiv.innerHTML = `
      <div class=\"lockout-bg-anim\"></div>
      <div class=\"glass-lockout-card\">
        <div class=\"lockout-icon-row\">${icon}</div>
        <h1 class=\"lockout-title\">${title}</h1>
        <div class=\"lockout-status-badge\">${status}</div>
        <div class=\"lockout-desc\">${description || ''}</div>
        ${apology}
      </div>
    `;
  }
}

function hideLockoutPanel() {
  if (appContainer) appContainer.style.display = '';
  if (copyrightFooter) copyrightFooter.style.display = '';
  if (siteLockoutDiv) {
    siteLockoutDiv.style.display = 'none';
    siteLockoutDiv.innerHTML = '';
  }
}

// --- Firebase Auth Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyBlb3hVDT1MZiIQM0eqVypw6EZACm14bdM",
  authDomain: "blueprint-57ad7.firebaseapp.com",
  projectId: "blueprint-57ad7",
  storageBucket: "blueprint-57ad7.firebasestorage.app",
  messagingSenderId: "517594030536",
  appId: "1:517594030536:web:472aa72fbe3623d3c660fd",
  measurementId: "G-1VCM6B0D39"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- GitHub Login Modal Logic ---
function openLoginModal() {
  document.getElementById('loginModal').classList.add('show');
}
function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('show');
}
function githubLogin() {
  const provider = new firebase.auth.GithubAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      alert(`Welcome, ${user.displayName || user.email || 'GitHub user'}!`);
      closeLoginModal();
      // You can now use user info in your app
    })
    .catch((error) => {
      alert('Login failed: ' + error.message);
    });
}
auth.onAuthStateChanged((user) => {
  const appContainer = document.querySelector('.container');
  const copyrightFooter = document.querySelector('.copyright-footer');
  const userInfoBar = document.getElementById('userInfoBar');
  if (user) {
    // User is logged in: show app, hide login modal
    if (appContainer) appContainer.style.display = '';
    if (copyrightFooter) copyrightFooter.style.display = '';
    closeLoginModal();
    // Show user info bar (force display: flex)
    if (userInfoBar) {
      userInfoBar.style.display = 'flex';
      userInfoBar.innerHTML = `
        <img class="user-avatar" src="${user.photoURL || ''}" alt="User avatar">
        <div class="user-details">
          <span class="user-name">${user.displayName || 'GitHub User'}</span>
          <span class="user-email">${user.email || ''}</span>
        </div>
        <button id="changeAccountButton" class="toolbar-button small" style="margin-left:12px; min-width:120px;">Change Account</button>
        <button id="logoutButton" class="toolbar-button small" style="margin-left:6px; min-width:90px;">Log Out</button>
      `;
      // Attach event listeners after setting innerHTML
      document.getElementById('logoutButton').onclick = function() {
        auth.signOut().then(() => {
          showNotification('Logged out successfully', 'success');
        }).catch((error) => {
          showNotification('Logout failed: ' + error.message, 'error');
        });
      };
      document.getElementById('changeAccountButton').onclick = function() {
        openChangeAccountModal();
      };
    }
  } else {
    // User not logged in: hide app, show login modal
    if (appContainer) appContainer.style.display = 'none';
    if (copyrightFooter) copyrightFooter.style.display = 'none';
    openLoginModal();
    // Hide user info bar
    if (userInfoBar) {
      userInfoBar.style.display = 'none';
      userInfoBar.innerHTML = '';
    }
  }
});
// ... existing code ...
// On page load, check auth state immediately
window.addEventListener('DOMContentLoaded', () => {
  if (!auth.currentUser) {
    openLoginModal();
    const appContainer = document.querySelector('.container');
    const copyrightFooter = document.querySelector('.copyright-footer');
    if (appContainer) appContainer.style.display = 'none';
    if (copyrightFooter) copyrightFooter.style.display = 'none';
  }
});

// --- Log Out and Change Account Logic ---
document.addEventListener('DOMContentLoaded', function() {
  const logoutButton = document.getElementById('logoutButton');
  const changeAccountButton = document.getElementById('changeAccountButton');
  if (logoutButton) {
    logoutButton.onclick = function() {
      auth.signOut().then(() => {
        showNotification('Logged out successfully', 'success');
      }).catch((error) => {
        showNotification('Logout failed: ' + error.message, 'error');
      });
    };
  }
  if (changeAccountButton) {
    changeAccountButton.onclick = function() {
      openChangeAccountModal();
    };
  }
});

function openChangeAccountModal() {
  const modal = document.getElementById('changeAccountModal');
  if (modal) modal.classList.add('show');
  renderAccountList();
}
function closeChangeAccountModal() {
  const modal = document.getElementById('changeAccountModal');
  if (modal) modal.classList.remove('show');
}

// For demo: store accounts in localStorage (in real app, use secure storage)
function getStoredAccounts() {
  try {
    return JSON.parse(localStorage.getItem('bp_accounts') || '[]');
  } catch { return []; }
}
function setStoredAccounts(accounts) {
  localStorage.setItem('bp_accounts', JSON.stringify(accounts));
}

function renderAccountList() {
  const accountList = document.getElementById('accountList');
  if (!accountList) return;
  const user = auth.currentUser;
  let accounts = getStoredAccounts();
  // Always show current user
  let html = '';
  if (user) {
    html += `<div style='padding:10px;border-radius:8px;background:#23243a;margin-bottom:8px;display:flex;align-items:center;gap:10px;'>` +
      `<img src='${user.photoURL || ''}' alt='avatar' style='width:32px;height:32px;border-radius:50%;border:1.5px solid #667eea;'>` +
      `<div style='flex:1;text-align:left;'><div style='font-weight:700;color:#ffbd2e;'>${user.displayName || 'GitHub User'}</div><div style='font-size:0.9em;color:#b0b6c8;'>${user.email || ''}</div></div>` +
      `<span style='font-size:0.9em;color:#27c93f;font-weight:600;'>Current</span></div>`;
  }
  if (accounts.length > 1 || (accounts.length === 1 && (!user || accounts[0].uid !== user.uid))) {
    html += '<div style="margin-bottom:8px;font-size:0.95em;color:#aaa;">Other Accounts:</div>';
    for (const acc of accounts) {
      if (user && acc.uid === user.uid) continue;
      html += `<div style='padding:8px;border-radius:8px;background:#181a20;margin-bottom:6px;display:flex;align-items:center;gap:10px;'>` +
        `<img src='${acc.photoURL || ''}' alt='avatar' style='width:28px;height:28px;border-radius:50%;border:1px solid #667eea;'>` +
        `<div style='flex:1;text-align:left;'><div style='font-weight:600;color:#ffbd2e;'>${acc.displayName || 'GitHub User'}</div><div style='font-size:0.9em;color:#b0b6c8;'>${acc.email || ''}</div></div>` +
        `<button class='toolbar-button small' style='padding:4px 10px;font-size:0.85em;' onclick='switchToAccount("${acc.uid}")'>Switch</button></div>`;
    }
  }
  accountList.innerHTML = html;
}

function addNewAccount() {
  // Sign in with GitHub, then store the new account
  const provider = new firebase.auth.GithubAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      let accounts = getStoredAccounts();
      if (!accounts.find(acc => acc.uid === user.uid)) {
        accounts.push({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
        setStoredAccounts(accounts);
      }
      showNotification('Account added and switched', 'success');
      closeChangeAccountModal();
    })
    .catch((error) => {
      showNotification('Login failed: ' + error.message, 'error');
    });
}

function switchToAccount(uid) {
  // For demo: log out and ask user to log in as that account
  showNotification('Please log in as the selected account.', 'info');
  auth.signOut().then(() => {
    closeChangeAccountModal();
    setTimeout(() => {
      openLoginModal();
    }, 500);
  });
}

// --- Lua End Reconstructor ---
function reconstructLuaEnds(code) {
  // Remove all 'end' and 'end)' statements
  let lines = code.split('\n');
  let cleanedLines = [];
  for (let line of lines) {
    let trimmed = line.trim();
    // Remove lines that are just 'end' or 'end)' or 'end,'
    if (/^end\)?[,;]?$/i.test(trimmed)) continue;
    // Remove trailing 'end' or 'end)' at the end of a line
    line = line.replace(/\bend\)?[,;]?\s*$/i, '');
    cleanedLines.push(line);
  }

  // Now reconstruct ends
  const blockOpeners = [
    { regex: /^\s*if\b.*then\b/i, type: 'if' },
    { regex: /^\s*for\b.*do\b/i, type: 'for' },
    { regex: /^\s*while\b.*do\b/i, type: 'while' },
    { regex: /^\s*function\b/i, type: 'function' },
    { regex: /^\s*repeat\b/i, type: 'repeat' },
    { regex: /^\s*do\b/i, type: 'do' },
    { regex: /^\s*else\b/i, type: 'else' },
    { regex: /^\s*elseif\b.*then\b/i, type: 'elseif' },
  ];
  const blockClosers = {
    'if': 'end',
    'for': 'end',
    'while': 'end',
    'function': 'end',
    'do': 'end',
    'repeat': 'until',
    'else': 'end',
    'elseif': 'end',
  };
  let stack = [];
  let output = [];
  for (let i = 0; i < cleanedLines.length; i++) {
    let line = cleanedLines[i];
    let trimmed = line.trim();
    let matched = false;
    for (let opener of blockOpeners) {
      if (opener.regex.test(trimmed)) {
        stack.push({ type: opener.type, line: i });
        matched = true;
        break;
      }
    }
    output.push(line);
    // Special handling for 'repeat' block: closes with 'until' not 'end'
    if (/^\s*until\b/i.test(trimmed)) {
      // Close the last 'repeat'
      let idx = stack.length - 1;
      while (idx >= 0 && stack[idx].type !== 'repeat') idx--;
      if (idx >= 0) stack.splice(idx, 1);
    }
    // Special handling for 'else'/'elseif': close previous 'if' block
    if (/^\s*else\b/i.test(trimmed) || /^\s*elseif\b.*then\b/i.test(trimmed)) {
      // Close previous block if it's 'if' or 'elseif'
      let idx = stack.length - 1;
      while (idx >= 0 && stack[idx].type !== 'if' && stack[idx].type !== 'elseif') idx--;
      if (idx >= 0) stack.splice(idx, 1);
      stack.push({ type: 'else', line: i });
    }
  }
  // Now close all open blocks
  while (stack.length > 0) {
    let block = stack.pop();
    let closer = blockClosers[block.type] || 'end';
    if (closer === 'until') {
      output.push('until true');
    } else {
      // Inline closure logic: if next line is a closing paren, append 'end' to current line
      let merged = false;
      for (let i = 0; i < output.length - 1; i++) {
        let curr = output[i];
        let next = output[i + 1].trim();
        if (/^\)*[,;]?$/i.test(next)) {
          // Find indentation of curr line
          let indent = curr.match(/^\s*/)[0];
          output[i] = curr + '\n' + indent + 'end';
          merged = true;
          break;
        }
      }
      if (!merged) {
        // If the last line is a closing paren, append 'end' before it
        if (output.length > 1 && /^\)*[,;]?$/i.test(output[output.length - 1].trim())) {
          let prev = output[output.length - 2];
          let indent = prev ? prev.match(/^\s*/)[0] : '';
          output[output.length - 2] = prev + '\n' + indent + 'end';
        } else {
          output.push('end');
        }
      }
    }
  }

  // Bracket/parenthesis balance check
  let paren = 0, square = 0, curly = 0;
  for (let line of output) {
    for (let c of line) {
      if (c === '(') paren++;
      if (c === ')') paren--;
      if (c === '[') square++;
      if (c === ']') square--;
      if (c === '{') curly++;
      if (c === '}') curly--;
    }
  }
  while (paren > 0) { output.push(')'); paren--; }
  while (square > 0) { output.push(']'); square--; }
  while (curly > 0) { output.push('}'); curly--; }

  return output.join('\n');
}
// ... existing code ...
// Patch generateLua to use reconstructLuaEnds
const _original_generateLua = generateLua;
generateLua = function(workspace) {
  let code = '';
  // Use the original logic to get the code string
  const blocks = workspace.getTopBlocks(true);
  if (blocks.length === 0) {
    code = '-- No blocks found in workspace\n-- Drag blocks from the toolbox to start coding!';
  } else {
    // Use the original generateLua logic
    _original_generateLua(workspace);
    code = document.getElementById('codeOutput').textContent;
  }
  // Remove and reconstruct ends
  code = reconstructLuaEnds(code);
  document.getElementById('codeOutput').textContent = code;
};
// ... existing code ...