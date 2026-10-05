# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import datetime
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from tqdm import tqdm


def create_divider_frame(
    width: int,
    height: int,
    prefix: str,
    date_time: str,
    background_path: str,
    fonts: dict,
) -> np.ndarray:
    """
    Create a divider frame with the specified text and background.

    Args:
        width (int): The width of the frame.
        height (int): The height of the frame.
        prefix (str): The prefix to display on the first line.
        date_time (str): The date and time to display on the second line.
        background_path (str): The path to the background image.
        fonts (dict): A dict with paths to the fonts.

    Returns:
        np.ndarray: The created divider frame.
    """
    background = cv2.imread(background_path)
    background = cv2.resize(background, (width, height))

    # Convert the background to a PIL image
    background_pil = Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(background_pil)

    # Load custom fonts
    font_bd = ImageFont.truetype(fonts["bold"], 60)
    font_rg = ImageFont.truetype(fonts["regular"], 45)

    # Calculate text positions using textbbox
    text_bbox_prefix = draw.textbbox((0, 0), prefix, font=font_bd)
    text_x_prefix = (width - (text_bbox_prefix[2] - text_bbox_prefix[0])) // 2
    text_y_prefix = (height // 2) - 60

    # Format the date_time as YYYY-MM-DD HH:MM:ss
    date_time_formatted = f"{date_time[:4]}-{date_time[4:6]}-{date_time[6:8]} {date_time[9:11]}:{date_time[11:13]}:{date_time[13:15]}"

    text_bbox_date_time = draw.textbbox((0, 0), date_time_formatted, font=font_rg)
    text_x_date_time = (width - (text_bbox_date_time[2] - text_bbox_date_time[0])) // 2
    text_y_date_time = (height // 2) + 20

    # Put text on the background
    draw.text(
        (text_x_prefix, text_y_prefix), prefix, font=font_bd, fill=(255, 255, 255)
    )
    draw.text(
        (text_x_date_time, text_y_date_time),
        date_time_formatted,
        font=font_rg,
        fill=(255, 255, 255),
    )

    # Convert the PIL image back to a NumPy array
    background = cv2.cvtColor(np.array(background_pil), cv2.COLOR_RGB2BGR)

    return background


def create_title_frame(
    width: int,
    height: int,
    username: str,
    models: list,
    car_name: str = None,
    event_name: str = None,
    background_path: str = None,
    logo_path: str = None,
    fonts: dict = None,
) -> np.ndarray:
    """
    Create a title frame to display at the start of a combined video.

    Args:
        width (int): The width of the frame.
        height (int): The height of the frame.
        username (str): The username to display on the first line.
        models (list): List of models used in the video, each with modelName.
        car_name (str, optional): The name of the car. Defaults to None.
        event_name (str, optional): The name of the event. Defaults to None.
        background_path (str): The path to the background image.
        logo_path (str): The path to the logo image.
        fonts (dict): A dict with paths to the fonts.

    Returns:
        np.ndarray: The created title frame.
    """
    background = cv2.imread(background_path)
    background = cv2.resize(background, (width, height))

    # Convert the background to a PIL image
    background_pil = Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(background_pil)

    # Add logo to the top left corner if provided
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
            
            # Resize logo to appropriate size (height of about 10% of the frame)
            logo_height = int(height * 0.2)  # 10% of frame height
            logo_width = int(logo.width * (logo_height / logo.height))
            logo = logo.resize((logo_width, logo_height), Image.LANCZOS)
            
            # Position logo in the top left with some padding
            padding = 20
            logo_position = (padding, padding)
            
            # Create a new image with alpha channel for proper transparency
            if logo.mode == 'RGBA':
                # Create a new RGB image with white background for PIL to handle transparency
                temp_img = Image.new('RGBA', background_pil.size, (0, 0, 0, 0))
                temp_img.paste(logo, logo_position)
                
                # Composite the images
                background_pil = Image.alpha_composite(
                    background_pil.convert('RGBA'), 
                    temp_img
                ).convert('RGB')
            else:
                # If no transparency, just paste directly
                background_pil.paste(logo, logo_position, logo)
            
            # Recreate the draw object after modifying the image
            draw = ImageDraw.Draw(background_pil)
            
        except Exception as e:
            print(f"Error adding logo: {e}")

    # Load custom fonts
    font_bd_50 = ImageFont.truetype(fonts["bold"], 50)  # Title font
    font_he_80 = ImageFont.truetype(fonts["heavy"], 80)  # Larger for racer name
    font_he_45 = ImageFont.truetype(fonts["heavy"], 45)  # Headers (Models)
    font_he_38 = ImageFont.truetype(fonts["heavy"], 38)  # Bold labels for footer
    font_rg = ImageFont.truetype(fonts["regular"], 40)  # Regular text
    font_sm = ImageFont.truetype(fonts["regular"], 38)  # Smaller text for models and footer

    vertical_start = height // 7  # Start slightly higher for better balance
    line_spacing = 90  # Increased spacing for the larger racer name
    
    # Draw the title - use event name if provided, otherwise use default
    title_text = event_name if event_name else "AWS DeepRacer Session"
    text_bbox_title = draw.textbbox((0, 0), title_text, font=font_bd_50)
    text_x_title = (width - (text_bbox_title[2] - text_bbox_title[0])) // 2
    
    # Draw the title
    draw.text(
        (text_x_title, vertical_start), 
        title_text, 
        font=font_bd_50, 
        fill=(255, 255, 255)
    )
    
    # Draw username (larger, centered)
    text_bbox_username = draw.textbbox((0, 0), username, font=font_he_80)
    text_x_username = (width - (text_bbox_username[2] - text_bbox_username[0])) // 2
    draw.text(
        (text_x_username, vertical_start + line_spacing), 
        username, 
        font=font_he_80, 
        fill=(255, 255, 255)
    )
    
    # Models header - centered in the main content area
    models_start_y = vertical_start + line_spacing * 2 + 30
    
    # Draw 'Models' or 'Model' label centered
    models_title = "Model" if len(models) == 1 else "Models"
    text_bbox_models_title = draw.textbbox((0, 0), models_title, font=font_he_45)
    text_x_models_title = (width - (text_bbox_models_title[2] - text_bbox_models_title[0])) // 2
    draw.text(
        (text_x_models_title, models_start_y), 
        models_title, 
        font=font_he_45, 
        fill=(255, 255, 255)
    )
    
    # List each model used, centered
    model_y = models_start_y + 60
    for model in models:
        model_text = model.get("modelName", "Unknown model")
        text_bbox_model = draw.textbbox((0, 0), model_text, font=font_sm)
        text_x_model = (width - (text_bbox_model[2] - text_bbox_model[0])) // 2
        draw.text(
            (text_x_model, model_y), 
            model_text, 
            font=font_sm, 
            fill=(255, 255, 255)
        )
        model_y += 45  # Slightly more space between model names
    
    # Footer area with Car and Created date
    footer_y = height - 100
    
    # Draw date on the right side - using bold for "Created" and regular for the date
    current_date = datetime.datetime.now().strftime('%Y-%m-%d')
    
    # First, draw the "Created" label in bold
    created_label = "Created"
    text_bbox_created = draw.textbbox((0, 0), created_label, font=font_he_38)
    
    # Then calculate the date width
    date_text = current_date
    text_bbox_date = draw.textbbox((0, 0), date_text, font=font_sm)
    
    # Calculate total width of the combined text for centering in the right half
    total_width = (text_bbox_created[2] - text_bbox_created[0]) + 10 + (text_bbox_date[2] - text_bbox_date[0])
    right_center_x = (width // 4) * 3
    start_x = right_center_x - (total_width // 2)
    
    # Draw the label
    draw.text(
        (start_x, footer_y), 
        created_label, 
        font=font_he_38, 
        fill=(255, 255, 255)
    )
    
    # Draw the date (with a space after "Created")
    draw.text(
        (start_x + (text_bbox_created[2] - text_bbox_created[0]) + 10, footer_y), 
        date_text, 
        font=font_sm, 
        fill=(255, 255, 255)
    )
    
    # Draw car info on the left side if provided - using bold for "Car" and regular for car name
    if car_name:
        # First, calculate the "Car" label width
        car_label = "Car"
        text_bbox_car_label = draw.textbbox((0, 0), car_label, font=font_he_38)
        
        # Then calculate the car name width
        car_name_text = car_name
        text_bbox_car_name = draw.textbbox((0, 0), car_name_text, font=font_sm)
        
        # Calculate total width for centering in left half
        total_width = (text_bbox_car_label[2] - text_bbox_car_label[0]) + 10 + (text_bbox_car_name[2] - text_bbox_car_name[0])
        left_center_x = width // 4
        start_x = left_center_x - (total_width // 2)
        
        # Draw the "Car" label in bold
        draw.text(
            (start_x, footer_y), 
            car_label, 
            font=font_he_38, 
            fill=(255, 255, 255)
        )
        
        # Draw the car name (with a space after "Car")
        draw.text(
            (start_x + (text_bbox_car_label[2] - text_bbox_car_label[0]) + 10, footer_y), 
            car_name_text, 
            font=font_sm, 
            fill=(255, 255, 255)
        )

    # Convert the PIL image back to a NumPy array
    background = cv2.cvtColor(np.array(background_pil), cv2.COLOR_RGB2BGR)

    return background


def create_lap_times_frame(
    width: int,
    height: int,
    race_data: dict,
    username: str = None,
    car_name: str = None,
    event_name: str = None,
    background_path: str = None,
    logo_path: str = None,
    fonts: dict = None,
) -> np.ndarray:
    """
    Create a frame to display lap times from race data.

    Args:
        width (int): The width of the frame.
        height (int): The height of the frame.
        race_data (dict): Dictionary containing race data with lap times.
        username (str): The username to display in the header.
        car_name (str): The name of the car to display in the header.
        event_name (str): The name of the event to display in the header.
        background_path (str): The path to the background image.
        logo_path (str): The path to the logo image.
        fonts (dict): A dict with paths to the fonts.

    Returns:
        np.ndarray: The created lap times frame.
    """
    background = cv2.imread(background_path)
    background = cv2.resize(background, (width, height))

    # Convert the background to a PIL image
    background_pil = Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(background_pil)

    # Load custom fonts
    font_he_32 = ImageFont.truetype(fonts["heavy"], 32)  # Section headers
    font_he_24 = ImageFont.truetype(fonts["heavy"], 24)  # Top bar labels
    font_bd_xs = ImageFont.truetype(fonts["bold"], 22)      # Important data
    font_rg = ImageFont.truetype(fonts["regular"], 36)   # Regular data
    font_sm = ImageFont.truetype(fonts["regular"], 24)   # Top bar values
    font_xs = ImageFont.truetype(fonts["light"], 22)   # Items
    
    # Define top bar area - make it more compact
    top_bar_height = height * 0.08  # Reduced from 0.1
    top_bar_y = 15  # Reduced from 20
    
    # Add logo to the top left corner if provided
    logo_width = 0
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
            
            # Resize logo to appropriate size (height of about 10% of the frame)
            logo_height = int(top_bar_height)
            logo_width = int(logo.width * (logo_height / logo.height))
            logo = logo.resize((logo_width, logo_height), Image.LANCZOS)
            
            # Position logo in the top left with some padding
            padding = 20
            logo_position = (padding, padding)
            
            # Create a new image with alpha channel for proper transparency
            if logo.mode == 'RGBA':
                temp_img = Image.new('RGBA', background_pil.size, (0, 0, 0, 0))
                temp_img.paste(logo, logo_position)
                
                # Composite the images
                background_pil = Image.alpha_composite(
                    background_pil.convert('RGBA'), 
                    temp_img
                ).convert('RGB')
            else:
                background_pil.paste(logo, logo_position, logo)
            
            # Recreate the draw object after modifying the image
            draw = ImageDraw.Draw(background_pil)
            
        except Exception as e:
            print(f"Error adding logo: {e}")
    
    # Calculate start position after logo
    left_margin = logo_width + 40 if logo_width > 0 else 20
    
    # Create a top bar with key info
    # Extract track info
    track_name = race_data.get('trackName', 'Unknown')
    
    # Determine which username to use
    display_username = username or race_data.get('username', 'Unknown Racer')
    
    # Create a header info section with key details
    header_items = [
        {"label": "Racer", "value": display_username},
        {"label": "Track", "value": track_name}
    ]
        
    # Calculate available width for the top bar (excluding logo area)
    available_width = width - left_margin - 20  # 20px right margin
    item_width = available_width / len(header_items)
    
    # Calculate vertical alignment for the top bar items
    logo_center_y = top_bar_y + (top_bar_height / 2)
    text_height = font_he_24.getbbox("a")[3]  # Approximate height of the text
    text_y = logo_center_y - (text_height / 2) - 5
    
    # Draw top bar items
    for i, item in enumerate(header_items):
        x_pos = left_margin + (i * item_width)
        
        # Combine label and value into a single string for centering
        combined_text = f"{item['label']}  {item['value']}"
        
        # Calculate the total width of the combined text
        combined_bbox = draw.textbbox((0, 0), combined_text, font=font_he_24)
        combined_width = combined_bbox[2] - combined_bbox[0]
        
        # Center the combined text within the item width
        combined_x = x_pos + (item_width - combined_width) / 2
        
        # Draw label and value separately, keeping their respective fonts
        label_text = f"{item['label']} "
        label_bbox = draw.textbbox((0, 0), label_text, font=font_he_24)
        label_width = label_bbox[2] - label_bbox[0]
        
        # Draw label in heavy font
        draw.text(
            (combined_x, text_y),
            label_text,
            font=font_he_24,
            fill=(255, 255, 255)
        )
        
        # Draw value in smaller font, positioned right after the label
        draw.text(
            (combined_x + label_width, text_y),
            item["value"],
            font=font_sm,
            fill=(255, 255, 255)
        )
        
    # Main title - more compact positioning
    vertical_start = top_bar_height + 10  # Reduced from 25
    title_text = "Lap Times"
    text_bbox_title = draw.textbbox((0, 0), title_text, font=font_he_32)
    text_x_title = (width - (text_bbox_title[2] - text_bbox_title[0])) // 2
    draw.text(
        (text_x_title, vertical_start), 
        title_text, 
        font=font_he_32, 
        fill=(255, 255, 255)
    )
    
    # Check if we have all the data we need
    if not race_data or 'laps' not in race_data or not race_data['laps']:
        no_data_text = "No lap data available"
        text_bbox_no_data = draw.textbbox((0, 0), no_data_text, font=font_rg)
        text_x_no_data = (width - (text_bbox_no_data[2] - text_bbox_no_data[0])) // 2
        draw.text(
            (text_x_no_data, height // 2), 
            no_data_text, 
            font=font_rg, 
            fill=(255, 255, 255)
        )
        
        # Convert and return early
        background = cv2.cvtColor(np.array(background_pil), cv2.COLOR_RGB2BGR)
        return background
    
    # Start of the two-column layout - moved higher
    table_start_y = vertical_start + 50  # Reduced from 100
    
    # Split the table area in two columns
    # Left column: Individual laps (65% of width)
    # Right column: Average times (35% of width)
    left_col_width = width * 0.6
    
    # Set up left column for lap times
    lap_col_x = left_col_width * 0.1
    time_col_x = left_col_width * 0.25
    diff_col_x = left_col_width * 0.45
    resets_col_x = left_col_width * 0.65
    valid_col_x = left_col_width * 0.8
    
    # Draw column headers for lap times
    draw.text((lap_col_x, table_start_y), "Lap", font=font_he_24, fill=(255, 255, 255))
    draw.text((time_col_x, table_start_y), "Time", font=font_he_24, fill=(255, 255, 255))
    draw.text((diff_col_x, table_start_y), "Diff", font=font_he_24, fill=(255, 255, 255))
    draw.text((resets_col_x, table_start_y), "Resets", font=font_he_24, fill=(255, 255, 255))
    draw.text((valid_col_x, table_start_y), "Valid", font=font_he_24, fill=(255, 255, 255))
    
    # Set up right column for averages
    avg_header_x = left_col_width + ((width - left_col_width) / 2)
    avg_col1_x = left_col_width + ((width - left_col_width) * 0.15)
    avg_col2_x = left_col_width + ((width - left_col_width) * 0.7)
    
    # Draw column header for average times
    avg_header_text = "Average Times"
    avg_header_bbox = draw.textbbox((0, 0), avg_header_text, font=font_he_24)
    avg_header_width = avg_header_bbox[2] - avg_header_bbox[0]
    
    draw.text(
        (avg_header_x - (avg_header_width / 2), table_start_y),
        avg_header_text,
        font=font_he_24,
        fill=(255, 255, 255)
    )
    
    # Draw horizontal line under column headers
    line_y = table_start_y + 35  # Reduced from 50
    COLOR_EDGE = (167, 131, 225)  # Converted hex color "#a783e1" to RGB
    draw.line([(0, line_y), (width, line_y)], fill=COLOR_EDGE, width=1)
    
    # Draw vertical dividing line between columns
    draw.line([(left_col_width, table_start_y), (left_col_width, height)], 
              fill=COLOR_EDGE, width=1)
    
    # Draw individual lap data
    row_y = line_y + 10
    row_height = 26  # Reduced from 40 to fit more rows
    
    # Calculate how many rows we can fit with the new top bar layout
    available_height = height - row_y - 20  # Reduced bottom margin from 50 to 30
    max_rows_that_fit = max(20, int(available_height / row_height))  # Ensure at least 20 rows
    max_rows = min(max_rows_that_fit, len(race_data['laps']))
    
    # Check if we need to display "continued on next page" message
    show_continued = len(race_data['laps']) > max_rows
    
    # Find the best lap time among valid laps
    valid_laps = [lap for lap in race_data['laps'] if lap.get('isValid', False)]
    best_lap_time = min(lap['time'] for lap in valid_laps) if valid_laps else None
    
    for i, lap in enumerate(race_data['laps'][:max_rows]):
        lap_num = str(lap['lapId'] + 1)  # Add 1 to 0-indexed lap IDs for display
        
        # Format time from milliseconds to seconds with 3 decimal places
        time_ms = lap['time']
        time_str = f"{time_ms/1000:.3f} s"
        
        # Calculate difference to the best lap
        if not lap.get('isValid', False):
            diff_str = ""
        else:
            diff_ms = time_ms - best_lap_time
            diff_str = f"+{diff_ms/1000:.3f} s" if diff_ms > 0 else "-0.000 s"
        
        resets = str(lap['resets'])
        valid = "Yes" if lap.get('isValid', False) else "No"
        
        # Determine color based on validity
        valid_color = (255, 255, 255) if lap.get('isValid', False) else (255, 150, 150)
        
        # Use bold font for the best lap, otherwise regular font
        lap_font = font_bd_xs if time_ms == best_lap_time else font_xs
        
        draw.text((lap_col_x, row_y), lap_num, font=lap_font, fill=(255, 255, 255))
        draw.text((time_col_x, row_y), time_str, font=lap_font, fill=(255, 255, 255))
        draw.text((diff_col_x, row_y), diff_str, font=lap_font, fill=(255, 255, 255))
        draw.text((resets_col_x, row_y), resets, font=lap_font, fill=(255, 255, 255))
        draw.text((valid_col_x, row_y), valid, font=lap_font, fill=valid_color)
        row_y += row_height
    
    if show_continued:
        continued_text = f"(+ {len(race_data['laps']) - max_rows} more laps)"
        draw.text(
            (lap_col_x, row_y + 5),  # Reduced from 10
            continued_text,
            font=font_sm,  # Use smaller font (font_sm instead of font_rg)
            fill=(200, 200, 200)
        )

    # Draw average lap times in the right column
    if 'averageLaps' in race_data and race_data['averageLaps']:
        avg_row_y = line_y + 15
        
        # Find the best average lap time
        best_avg_time = min(avg['avgTime'] for avg in race_data['averageLaps'])
        
        for avg in race_data['averageLaps']:
            # Format the laps range and time
            start_lap = avg['startLapId'] + 1  # Add 1 to 0-indexed lap IDs
            end_lap = avg['endLapId'] + 1
            laps_range = f"Laps {start_lap}-{end_lap}"
            
            avg_time = avg['avgTime']
            avg_time_str = f"{avg_time/1000:.3f} s"
            
            # Highlight the best average lap time
            font_to_use = font_bd_xs if avg_time == best_avg_time else font_xs
           
            draw.text((avg_col1_x, avg_row_y), laps_range, font=font_to_use, fill=(255, 255, 255))
            draw.text((avg_col2_x, avg_row_y), avg_time_str, font=font_to_use, fill=(255, 255, 255))
            
            avg_row_y += row_height
    
    # Convert the PIL image back to a NumPy array
    background = cv2.cvtColor(np.array(background_pil), cv2.COLOR_RGB2BGR)

    return background

def combine_videos(
    video_files: list,
    output_file: str,
    image_assets: dict,
    fonts: dict,
    codec: str = "avc1",
    skip_duration: float = 20.0,
    update_frequency: float = 0.1,
    metadata: dict = None,
) -> dict:
    """
    Combine multiple video files into a single video file.

    Args:
        video_files (list): A list of video file paths to combine.
        output_file (str): The path to the output video file.
        image_assets (dict): A dict with paths to the background image and logo.
        fonts (dict): A dict with paths to the fonts.
        codec (str): The codec for the video writer.
        skip_duration (float): Skip video files with duration less than the specified value.
        update_frequency (float): Update frequency for the progress bar.
        metadata (dict): Additional race data including username, models, car_name, and event_name.

    Returns:
        dict: Information about the combined video file.
    """
    if not video_files:
        print("No video files to combine.")
        return {}

    print(f"Starting new video file: {output_file}")

    # Get the properties of the first video
    cap = cv2.VideoCapture(video_files[0])
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()

    # Create a video writer
    fourcc = cv2.VideoWriter_fourcc(*codec)
    out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

    total_duration = 0
    included_videos = 0
    
    # Add title frame at the beginning
    title_duration = 3.0  # Show title frame for 3 seconds
    if metadata and metadata.get('username') and metadata.get('models'):
        title_frame = create_title_frame(
            width,
            height,
            metadata.get('username'),
            metadata.get('models'),
            car_name=metadata.get('car_name'),
            event_name=metadata.get('event_name'),
            background_path=image_assets.get('background'),
            logo_path=image_assets.get('logo'),
            fonts=fonts
        )
        
        for _ in range(int(fps * title_duration)):
            out.write(title_frame)
        
        total_duration += title_duration
    
    # Add lap times frame if race data is available
    if metadata and metadata.get('race_data') and metadata['race_data'].get('laps'):
        lap_times_duration = 4.0  # Show lap times for 4 seconds
        lap_times_frame = create_lap_times_frame(
            width,
            height,
            metadata.get('race_data'),
            username=metadata.get('username'),
            car_name=metadata.get('car_name'),
            event_name=metadata.get('event_name'),
            background_path=image_assets.get('background'),
            logo_path=image_assets.get('logo'),
            fonts=fonts
        )
        
        for _ in range(int(fps * lap_times_duration)):
            out.write(lap_times_frame)
        
        total_duration += lap_times_duration

    divider_duration = 1.5  # Duration of the divider frame in seconds

    # Rest of the function remains unchanged
    for video_file in video_files:
        # Extract prefix and date_time from the filename
        parts = os.path.basename(video_file).split("-")
        prefix = "-".join(parts[:-2])
        date_time = "-".join(parts[-2:]).replace(".mp4", "")

        cap = cv2.VideoCapture(video_file)
        duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        if duration < skip_duration:
            print(f"Skipping {video_file} (duration: {duration:.2f} seconds)")
            cap.release()
            continue

        total_duration += duration
        included_videos += 1

        # Create and write divider frame
        divider_frame = create_divider_frame(
            width,
            height,
            prefix,
            date_time,
            image_assets["background"],
            fonts
        )
        for _ in range(
            int(fps * divider_duration)
        ):  # Display the divider for 1.5 second
            out.write(divider_frame)

        total_duration += divider_duration

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        with tqdm(
            total=total_frames,
            desc=f"Processing {os.path.basename(video_file)}",
            unit="frames",
            mininterval=update_frequency,
        ) as pbar:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                out.write(frame)
                pbar.update(1)
        cap.release()

    out.release()
    print(f"Finished video file: {output_file}")

    return {
        "output_file": output_file,
        "resolution": f"{width}x{height}",
        "duration": total_duration,
        "codec": codec,
        "fps": fps,
        "included_videos": included_videos,
    }
